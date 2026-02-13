/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Employee Orders
 * Create and view delivery orders
 *
 * Last verified: 2026-02-09
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { updateDoc, doc } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { logPumpMovement } from "@/lib/pumpLogger";
import { normalizePumpScannerInput } from "@/lib/pumpScanner";
import { sendAppEmail } from "@/lib/emailClient";

/* ---------- Types ---------- */
type Pump = {
  id: string;
  pumpNumber: string;
  status?: string | null;
  maintenanceDue?: boolean;
};

type Customer = {
  id: string;
  name: string;
  city: string;
  address?: string;
  state?: string;
  country?: string;
  returnReminderNote?: string;
};

type DeliveryBackup = {
  id: string;
  customerName?: string;
  driverName?: string;
  deliveredAt?: any;
  deliveredAtISO?: string;
  statusUpdatedAt?: any;
  createdAt?: any;
  legalPdfUrl?: string;
  status?: string;
};

/* ---------- Helpers ---------- */
function formatDate(ts: any) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("en-US");
  if (ts?.toDate) return ts.toDate().toLocaleString("en-US");
  return "—";
}

export default function EmployeeOrdersPage() {
  const router = useRouter();

  /* ---------- Context ---------- */
  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const pharmacyName =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_NAME")
      : "";

  const employeeId =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_ID")
      : null;

  const employeeName =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_NAME")
      : "UNKNOWN";

  /* ---------- State ---------- */
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryBackups, setDeliveryBackups] = useState<DeliveryBackup[]>([]);

  const [pumpIds, setPumpIds] = useState<string[]>([]);
  const [pumpNumbers, setPumpNumbers] = useState<string[]>([]);
  const [pumpSearch, setPumpSearch] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [customerPreviousPumps, setCustomerPreviousPumps] = useState<string[]>([]);
  const [customerPumpsLoading, setCustomerPumpsLoading] = useState(false);
  const [pdfEmailByOrder, setPdfEmailByOrder] = useState<Record<string, string>>({});
  const [pdfSendingByOrder, setPdfSendingByOrder] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const pumpSearchRef = useRef<HTMLInputElement>(null);

  /* ---------- Init ---------- */
  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();

      if (!pharmacyId || !employeeId) {
        setError("Missing employee or pharmacy context");
        return;
      }

      await loadPumps();
      await loadCustomers();
    })();
  }, []);

  useEffect(() => {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "orders"),
      where("pharmacyId", "==", pharmacyId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (o) =>
            !!o.legalPdfUrl &&
            (o.status === "DELIVERED" || o.deliveredAt || o.deliveredAtISO)
        )
        .sort((a, b) => {
          const toMs = (ts: any) => {
            if (!ts) return 0;
            if (typeof ts === "string") return new Date(ts).getTime();
            if (ts?.toDate) return ts.toDate().getTime();
            return 0;
          };

          return (
            toMs(b.deliveredAt || b.deliveredAtISO || b.statusUpdatedAt || b.createdAt) -
            toMs(a.deliveredAt || a.deliveredAtISO || a.statusUpdatedAt || a.createdAt)
          );
        })
        .slice(0, 10);

      setDeliveryBackups(list);
    });

    return () => unsub();
  }, [pharmacyId]);

  useEffect(() => {
    if (!customerId) {
      setCustomerPreviousPumps([]);
      return;
    }

    loadCustomerPreviousPumps(customerId);
  }, [customerId]);

  /* ---------- Loaders ---------- */
  async function loadPumps() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "pumps"),
      where("pharmacyId", "==", pharmacyId),
      where("active", "==", true)
    );

    const snap = await getDocs(q);

    const list = snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          pumpNumber: data.pumpNumber || String(data.pump || ""),
          status: data.status ?? null,
          maintenanceDue: data.maintenanceDue === true,
        } as Pump;
      })
      .filter((p) => (!p.status || p.status === "AVAILABLE") && !p.maintenanceDue);

    setPumps(list);
  }

  async function loadCustomers() {
    const q = query(
      collection(db, "customers"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);
    setCustomers(
      snap.docs.map((d) => ({
        id: d.id,
        name: d.data().customerName,
        city: d.data().city,
        address: d.data().address,
        state: d.data().state,
        country: d.data().country,
        returnReminderNote: d.data().returnReminderNote,
      }))
    );
  }

  async function loadCustomerPreviousPumps(targetCustomerId: string) {
    if (!pharmacyId) return;

    setCustomerPumpsLoading(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId),
        where("customerId", "==", targetCustomerId)
      );

      const snap = await getDocs(q);
      const pumpSet = new Set<string>();

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const numbers = (data.pumpNumbers || []) as any[];
        numbers.forEach((num) => {
          if (num) pumpSet.add(String(num));
        });
      });

      setCustomerPreviousPumps(Array.from(pumpSet));
    } catch (err) {
      console.error("loadCustomerPreviousPumps error:", err);
      setCustomerPreviousPumps([]);
    } finally {
      setCustomerPumpsLoading(false);
    }
  }

  /* ---------- Create Order ---------- */
  async function handleCreateOrder() {
    setError("");

    if (pumpIds.length === 0 || !customerId) {
      setError("At least one pump and a customer are required");
      return;
    }

    setLoading(true);

    try {
      await ensureAnonymousAuth();

      /**
       * 🔒 BLOQUEO ABSOLUTO DE PUMPS OCUPADOS
       * - Busca en Firestore
       * - Cualquier pedido NO ENTREGADO
       * - Sin importar cliente, empleado o conductor
       */
      const q = query(
        collection(db, "orders"),
        where("pumpNumbers", "array-contains-any", pumpNumbers)
      );

      const snap = await getDocs(q);

      const conflict = snap.docs.find((d) => {
        const data = d.data() as any;
        const rawStatus = String(data.status || "").trim().toUpperCase();
        const effectiveStatus =
          rawStatus === "DELIVERED" || data.deliveredAt || data.deliveredAtISO
            ? "DELIVERED"
            : rawStatus || "PENDING";

        return effectiveStatus !== "DELIVERED";
      });

      if (conflict) {
        setError(
          "One or more selected pumps are already assigned to an active order."
        );
        await loadPumps();
        setLoading(false);
        return;
      }

      const selectedPumpDocs = await Promise.all(
        pumpIds.map((pumpId) => getDoc(doc(db, "pumps", pumpId)))
      );

      const unavailablePumpNumbers: string[] = [];

      selectedPumpDocs.forEach((pumpDoc, index) => {
        const pumpData = (pumpDoc.data() || {}) as any;
        const status = String(pumpData.status || "AVAILABLE").trim().toUpperCase();
        const maintenanceDue = pumpData.maintenanceDue === true;
        const active = pumpData.active !== false;

        if (!pumpDoc.exists() || !active || maintenanceDue || status !== "AVAILABLE") {
          unavailablePumpNumbers.push(pumpNumbers[index]);
        }
      });

      if (unavailablePumpNumbers.length > 0) {
        setError(
          `These pumps are no longer available: ${unavailablePumpNumbers.join(", ")}. Refreshing list...`
        );
        await loadPumps();
        setPumpIds((prev) =>
          prev.filter((_, idx) => !unavailablePumpNumbers.includes(pumpNumbers[idx]))
        );
        setPumpNumbers((prev) =>
          prev.filter((num) => !unavailablePumpNumbers.includes(num))
        );
        setLoading(false);
        return;
      }

      const customer = customers.find((c) => c.id === customerId);

      const orderPayload = {
        pharmacyId,
        pharmacyName,
        pumpIds,
        pumpNumbers,
        customerId,
        customerName: customers.find((c) => c.id === customerId)?.name,
        customerCity: customers.find((c) => c.id === customerId)?.city,
        customerAddress: customers.find((c) => c.id === customerId)?.address,
        customerState: customers.find((c) => c.id === customerId)?.state,
        customerCountry: customers.find((c) => c.id === customerId)?.country,
        customerPreviousPumps,
        returnReminderNote:
          customers.find((c) => c.id === customerId)?.returnReminderNote || "",
        createdByEmployeeName: employeeName,
        createdByEmployeeId: employeeId,
        status: "PENDING",
        createdAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
      };

      console.log("Creating order with payload:", orderPayload);

      const orderRef = await addDoc(collection(db, "orders"), orderPayload);

      // ✅ ACTUALIZAR ESTADO DE CADA PUMP (no bloquear si falta permiso)
      const pumpUpdateFailures: string[] = [];

      for (let i = 0; i < pumpIds.length; i++) {
        try {
          await updateDoc(doc(db, "pumps", pumpIds[i]), {
            status: "ASSIGNED",
          });

          await logPumpMovement({
            pumpId: pumpIds[i],
            pumpNumber: pumpNumbers[i],
            pharmacyId: pharmacyId!,
            orderId: orderRef.id,
            action: "ASSIGNED",
            performedById: employeeId!,
            performedByName: employeeName!,
            role: "EMPLOYEE",
          });
        } catch (err) {
          console.warn("Pump update/log failed:", pumpIds[i], err);
          pumpUpdateFailures.push(pumpNumbers[i]);
        }
      }

      setPumpIds([]);
      setPumpNumbers([]);
      setPumpSearch("");
      setCustomerId("");
      await loadPumps();

      if (pumpUpdateFailures.length > 0) {
        setInfo(
          `Order created, but some pump updates failed due to permissions. Pumps: ${pumpUpdateFailures.join(", ")}.`
        );
      } else {
        setInfo("Order created and set to PENDING — drivers will receive it.");
      }
      setTimeout(() => setInfo(""), 6000);

    } catch (err: any) {
      console.error("handleCreateOrder error:", err);
      setError(
        err?.message ? `Failed to create order: ${err.message}` : "Failed to create order"
      );
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Derived ---------- */
  const filteredPumps = pumps.filter(
    (p) =>
      p.pumpNumber.toLowerCase().includes(normalizePumpScannerInput(pumpSearch).toLowerCase()) &&
      !pumpIds.includes(p.id)
  );

  function focusPumpSearchInput() {
    setTimeout(() => {
      pumpSearchRef.current?.focus();
    }, 0);
  }

  function addPumpFromScannedValue(rawValue: string) {
    const normalized = normalizePumpScannerInput(rawValue);
    if (!normalized) return;

    const exact = pumps.find(
      (p) => p.pumpNumber.toUpperCase() === normalized && !pumpIds.includes(p.id)
    );

    const candidate =
      exact ||
      pumps.find(
        (p) =>
          p.pumpNumber.toUpperCase().includes(normalized) &&
          !pumpIds.includes(p.id)
      );

    if (!candidate) {
      setError(`Pump not found: ${normalized}`);
      return;
    }

    setPumpIds((prev) => [...prev, candidate.id]);
    setPumpNumbers((prev) => [...prev, candidate.pumpNumber]);
    setPumpSearch("");
    setError("");
    focusPumpSearchInput();
  }

  function handlePumpScannerEnter() {
    addPumpFromScannedValue(pumpSearch);
  }

  function handlePumpScannerBatch(rawValue: string) {
    const parts = rawValue
      .split(/[\r\n\t,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      setPumpSearch(rawValue);
      return;
    }

    parts.forEach((part) => addPumpFromScannedValue(part));
    setPumpSearch("");
    focusPumpSearchInput();
  }

  async function handleSharePdfByEmail(backup: DeliveryBackup) {
    if (!backup.legalPdfUrl) {
      setError("PDF is not available yet.");
      return;
    }

    const normalizedTo = (pdfEmailByOrder[backup.id] || "").trim();
    if (!normalizedTo) {
      setError("Please enter recipient email first.");
      return;
    }

    if (!normalizedTo.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setPdfSendingByOrder((prev) => ({ ...prev, [backup.id]: true }));

    try {
      await sendAppEmail({
        to: normalizedTo,
        subject: `Delivery PDF - Order ${backup.id}`,
        html: `
          <p>Hello,</p>
          <p>Here is the legal delivery PDF backup for order <strong>${backup.id}</strong>.</p>
          <p><a href="${backup.legalPdfUrl}" target="_blank" rel="noreferrer">Open Delivery PDF</a></p>
        `,
        text: `Delivery PDF backup for order ${backup.id}: ${backup.legalPdfUrl}`,
      });

      setInfo(`PDF shared by email to ${normalizedTo}.`);
      setPdfEmailByOrder((prev) => ({ ...prev, [backup.id]: "" }));
      setTimeout(() => setInfo(""), 6000);
    } finally {
      setPdfSendingByOrder((prev) => ({ ...prev, [backup.id]: false }));
    }
  }

  /* ---------- UI ---------- */
  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-3xl space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-sm text-white/60">
            Create and manage delivery orders
          </p>
        </div>

        {/* CREATE ORDER */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Create New Order</h2>

          <select
            value={customerId}
            onChange={(e) => {
              const nextCustomerId = e.target.value;
              const changedCustomer = customerId && customerId !== nextCustomerId;

              setCustomerId(nextCustomerId);

              if (changedCustomer) {
                setPumpIds([]);
                setPumpNumbers([]);
                setPumpSearch("");
              }
            }}
            className="w-full p-2 rounded bg-black border border-white/10"
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>

          {!customerId && (
            <p className="text-xs text-white/60">
              Select a customer first to load customer info and add medical pumps.
            </p>
          )}

          {customerId && (
            <>
              <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold">Customer Information</p>
                <p className="text-xs text-white/70">
                  Name: {customers.find((c) => c.id === customerId)?.name}
                </p>
                <p className="text-xs text-white/60">
                  City: {customers.find((c) => c.id === customerId)?.city || "—"}
                </p>
                <p className="text-xs text-white/60">
                  Address: {customers.find((c) => c.id === customerId)?.address || "—"}
                </p>
              </div>

              <input
                ref={pumpSearchRef}
                value={pumpSearch}
                onChange={(e) => handlePumpScannerBatch(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (!pasted) return;
                  e.preventDefault();
                  handlePumpScannerBatch(pasted);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePumpScannerEnter();
                  }
                }}
                placeholder="Search pump (type or scan barcode/QR)..."
                className="w-full p-2 rounded bg-black border border-white/10"
                autoFocus
              />

              {pumpSearch && (
                <div className="border border-white/10 rounded bg-black max-h-40 overflow-y-auto">
                  {filteredPumps.length === 0 && (
                    <p className="text-xs text-white/50 p-2">
                      No pumps found
                    </p>
                  )}

                  {filteredPumps.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPumpIds((prev) => [...prev, p.id]);
                        setPumpNumbers((prev) => [...prev, p.pumpNumber]);
                        setPumpSearch("");
                        focusPumpSearchInput();
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    >
                      Pump #{p.pumpNumber}
                    </button>
                  ))}
                </div>
              )}

              {pumpNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pumpNumbers.map((num, idx) => (
                    <span
                      key={num}
                      className="bg-white/10 text-sm px-3 py-1 rounded flex items-center gap-2"
                    >
                      Pump #{num}
                      <button
                        type="button"
                        onClick={() => {
                          setPumpNumbers((prev) =>
                            prev.filter((_, i) => i !== idx)
                          );
                          setPumpIds((prev) =>
                            prev.filter((_, i) => i !== idx)
                          );
                        }}
                        className="text-red-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold">Customer Pump Reminder</p>
              {customerPumpsLoading && (
                <p className="text-xs text-white/60">Loading previous pumps...</p>
              )}

              {!customerPumpsLoading && customerPreviousPumps.length === 0 && (
                <p className="text-xs text-white/60">No previous pumps found.</p>
              )}

              {!customerPumpsLoading && customerPreviousPumps.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customerPreviousPumps.map((num) => (
                    <span
                      key={num}
                      className="bg-white/10 text-xs px-3 py-1 rounded"
                    >
                      Pump #{num}
                    </span>
                  ))}
                </div>
              )}

              {customers.find((c) => c.id === customerId)?.returnReminderNote && (
                <p className="text-xs text-yellow-300">
                  Reminder for driver: {customers.find((c) => c.id === customerId)?.returnReminderNote}
                </p>
              )}
              </div>
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {info && <p className="text-green-400 text-sm">{info}</p>}

          <button
            onClick={handleCreateOrder}
            disabled={loading}
            className="w-full bg-indigo-600 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? "CREATING..." : "CREATE ORDER"}
          </button>
        </div>

        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-cyan-300">Delivery PDF Backups</h2>
          {deliveryBackups.length === 0 && (
            <p className="text-xs text-white/60">No delivery PDFs available yet.</p>
          )}
          {deliveryBackups.length > 0 && (
            <ul className="space-y-3">
              {deliveryBackups.map((o) => (
                <li
                  key={`backup-${o.id}`}
                  className="border border-cyan-500/20 rounded p-4 space-y-1"
                >
                  <p className="text-sm font-semibold">{o.customerName || "Customer"}</p>
                  <p className="text-xs text-white/60">Driver: {o.driverName || "Unassigned"}</p>
                  <p className="text-xs text-white/50">
                    Delivered: {formatDate(o.deliveredAt || o.deliveredAtISO || o.statusUpdatedAt || o.createdAt)}
                  </p>
                  <a
                    href={o.legalPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500"
                  >
                    VIEW PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => handleSharePdfByEmail(o)}
                    disabled={pdfSendingByOrder[o.id] === true}
                    className="ml-2 text-xs px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {pdfSendingByOrder[o.id] ? "SENDING..." : "SHARE BY EMAIL"}
                  </button>
                  <input
                    type="email"
                    value={pdfEmailByOrder[o.id] || ""}
                    onChange={(e) =>
                      setPdfEmailByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))
                    }
                    placeholder="recipient@email.com"
                    className="mt-2 w-full p-2 rounded bg-black border border-white/10 text-xs"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push("/employee/dashboard")}
            className="text-xs text-white/50 hover:text-white"
          >
            ← Back to Employee Dashboard
          </button>
        </div>

      </div>
    </main>
  );
}
