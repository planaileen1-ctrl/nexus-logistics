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
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { updateDoc, doc } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { logPumpMovement } from "@/lib/pumpLogger";
import { normalizePumpScannerInput } from "@/lib/pumpScanner";

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

type ActivityOrder = {
  id: string;
  status: string;
  customerName?: string;
  customerCity?: string;
  pumpNumbers?: string[];
  driverName?: string;
  createdByEmployeeName?: string;
  createdAt?: any;
  assignedAt?: any;
  startedAt?: any;
  arrivedAt?: any;
  deliveredAt?: any;
  statusUpdatedAt?: any;
};

/* ---------- Helpers ---------- */
export default function EmployeeOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const [pumpIds, setPumpIds] = useState<string[]>([]);
  const [pumpNumbers, setPumpNumbers] = useState<string[]>([]);
  const [pumpSearch, setPumpSearch] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [customerPreviousPumps, setCustomerPreviousPumps] = useState<string[]>([]);
  const [customerPumpsLoading, setCustomerPumpsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const pumpSearchRef = useRef<HTMLInputElement>(null);
  const [activityOrders, setActivityOrders] = useState<ActivityOrder[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityStatusFilter, setActivityStatusFilter] = useState<"ALL" | "ACTIVE" | "DELIVERED">("ALL");

  const currentView = searchParams.get("view") === "activity" ? "activity" : "create";

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
    if (!customerId) {
      setCustomerPreviousPumps([]);
      return;
    }

    loadCustomerPreviousPumps(customerId);
  }, [customerId]);

  useEffect(() => {
    if (currentView !== "activity") return;
    loadOrdersActivity();
  }, [currentView, pharmacyId]);

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

  function timestampToMillis(ts: any) {
    if (!ts) return 0;
    if (typeof ts === "string") return new Date(ts).getTime();
    if (ts?.toDate) return ts.toDate().getTime();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    return 0;
  }

  function formatTimestamp(ts: any) {
    if (!ts) return "—";
    if (typeof ts === "string") return new Date(ts).toLocaleString("en-US");
    if (ts?.toDate) return ts.toDate().toLocaleString("en-US");
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString("en-US");
    return "—";
  }

  function getStatusMeta(rawStatus?: string) {
    const status = String(rawStatus || "PENDING").trim().toUpperCase();

    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: {
        label: "Pending",
        className: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
      },
      ASSIGNED: {
        label: "Assigned",
        className: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
      },
      IN_PROGRESS: {
        label: "In Progress",
        className: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
      },
      ON_WAY_TO_PHARMACY: {
        label: "On the way to Pharmacy",
        className: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
      },
      ON_WAY_TO_CUSTOMER: {
        label: "On the way to Customer",
        className: "bg-teal-500/20 text-teal-300 border border-teal-500/40",
      },
      DELIVERED: {
        label: "Delivered",
        className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
      },
      CANCELLED: {
        label: "Cancelled",
        className: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
      },
    };

    return statusMap[status] || {
      label: status,
      className: "bg-white/10 text-white/80 border border-white/20",
    };
  }

  const filteredActivityOrders = activityOrders.filter((order) => {
    const status = String(order.status || "PENDING").trim().toUpperCase();

    if (activityStatusFilter === "DELIVERED") {
      return status === "DELIVERED";
    }

    if (activityStatusFilter === "ACTIVE") {
      return status !== "DELIVERED" && status !== "CANCELLED";
    }

    return true;
  });

  const allActivityCount = activityOrders.length;
  const activeActivityCount = activityOrders.filter((order) => {
    const status = String(order.status || "PENDING").trim().toUpperCase();
    return status !== "DELIVERED" && status !== "CANCELLED";
  }).length;
  const deliveredActivityCount = activityOrders.filter((order) => {
    const status = String(order.status || "PENDING").trim().toUpperCase();
    return status === "DELIVERED";
  }).length;

  async function loadOrdersActivity() {
    if (!pharmacyId) {
      setError("Missing pharmacy context");
      return;
    }

    setActivityLoading(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as ActivityOrder[];

      list.sort((a, b) => {
        const aTime = timestampToMillis(a.createdAt) || timestampToMillis(a.statusUpdatedAt);
        const bTime = timestampToMillis(b.createdAt) || timestampToMillis(b.statusUpdatedAt);
        return bTime - aTime;
      });

      setActivityOrders(list);
    } catch (err) {
      console.error("loadOrdersActivity error:", err);
      setError("Failed to load orders activity");
    } finally {
      setActivityLoading(false);
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
       * 🔒 ABSOLUTE LOCK FOR OCCUPIED PUMPS
       * - Checks Firestore
       * - Any order NOT DELIVERED
       * - Regardless of customer, employee, or driver
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

  /* ---------- UI ---------- */
  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-3xl space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-sm text-white/60">
            {currentView === "activity"
              ? "Track all created orders and driver progress"
              : "Create and manage delivery orders"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.replace("/employee/orders?view=create")}
            className={`rounded-lg py-2 text-sm font-semibold border transition-colors ${
              currentView === "create"
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-black/30 border-white/10 text-white/70 hover:text-white"
            }`}
          >
            New Shipping Order
          </button>
          <button
            type="button"
            onClick={() => router.replace("/employee/orders?view=activity")}
            className={`rounded-lg py-2 text-sm font-semibold border transition-colors ${
              currentView === "activity"
                ? "bg-cyan-600 border-cyan-500 text-white"
                : "bg-black/30 border-white/10 text-white/70 hover:text-white"
            }`}
          >
            Orders Activity
          </button>
        </div>

        {currentView === "create" && (
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
        )}

        {currentView === "activity" && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Orders Activity Feed</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivityStatusFilter("ALL")}
                  className={`text-xs px-3 py-1 rounded border ${
                    activityStatusFilter === "ALL"
                      ? "bg-white/15 border-white/40"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  All ({allActivityCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityStatusFilter("ACTIVE")}
                  className={`text-xs px-3 py-1 rounded border ${
                    activityStatusFilter === "ACTIVE"
                      ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  Active ({activeActivityCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityStatusFilter("DELIVERED")}
                  className={`text-xs px-3 py-1 rounded border ${
                    activityStatusFilter === "DELIVERED"
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  Delivered ({deliveredActivityCount})
                </button>
                <button
                  type="button"
                  onClick={loadOrdersActivity}
                  className="text-xs px-3 py-1 rounded border border-white/20 hover:border-white/40"
                >
                  Refresh
                </button>
              </div>
            </div>

            {activityLoading && (
              <p className="text-sm text-white/60">Loading orders activity...</p>
            )}

            {!activityLoading && filteredActivityOrders.length === 0 && (
              <p className="text-sm text-white/60">No orders created yet.</p>
            )}

            {!activityLoading && filteredActivityOrders.length > 0 && (
              <div className="space-y-3">
                {filteredActivityOrders.map((o) => (
                  <div key={o.id} className="border border-white/10 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Order #{o.id.slice(0, 8)}</p>
                      <span
                        className={`text-xs px-2 py-1 rounded ${getStatusMeta(o.status).className}`}
                      >
                        {getStatusMeta(o.status).label}
                      </span>
                    </div>

                    <p className="text-xs text-white/70">
                      Customer: {o.customerName || "—"}
                      {o.customerCity ? ` (${o.customerCity})` : ""}
                    </p>

                    <p className="text-xs text-white/60">
                      Pumps: {o.pumpNumbers && o.pumpNumbers.length > 0 ? o.pumpNumbers.join(", ") : "—"}
                    </p>

                    <p className="text-xs text-white/60">
                      Driver: {o.driverName || "Not assigned yet"}
                    </p>

                    <p className="text-xs text-white/60">
                      Created by: {o.createdByEmployeeName || "—"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-white/50">
                      <p>Created: {formatTimestamp(o.createdAt)}</p>
                      <p>Assigned: {formatTimestamp(o.assignedAt)}</p>
                      <p>Arrived: {formatTimestamp(o.arrivedAt)}</p>
                      <p>Delivered: {formatTimestamp(o.deliveredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
