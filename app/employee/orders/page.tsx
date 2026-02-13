/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Employee Orders
 * Create and view delivery orders
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { updateDoc, doc } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { logPumpMovement } from "@/lib/pumpLogger";

/* ---------- Types ---------- */
type Pump = {
  id: string;
  pumpNumber: string;
  status?: string | null;
};

type Customer = {
  id: string;
  name: string;
  city: string;
  address?: string;
  state?: string;
  country?: string;
};

type Order = {
  id: string;
  pumpNumbers: string[];
  customerName: string;
  customerCity?: string;
  customerAddress?: string;
  customerState?: string;
  customerCountry?: string;
  createdByEmployeeName: string;
  status: string;
  createdAt: any;
  statusUpdatedAt?: any;
  assignedAt?: any;
  deliveredAt?: any;
  deliveredAtISO?: string;
  driverName?: string;
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
  const [orders, setOrders] = useState<Order[]>([]);

  const [pumpIds, setPumpIds] = useState<string[]>([]);
  const [pumpNumbers, setPumpNumbers] = useState<string[]>([]);
  const [pumpSearch, setPumpSearch] = useState("");

  const [customerId, setCustomerId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  /* ---------- Init ---------- */
  useEffect(() => {
    let unsubscribe: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();

      if (!pharmacyId || !employeeId) {
        setError("Missing employee or pharmacy context");
        return;
      }

      await loadPumps();
      await loadCustomers();
      unsubscribe = subscribeOrders();
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

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
        } as Pump;
      })
      .filter((p) => !p.status || p.status === "AVAILABLE");

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
      }))
    );
  }

  function subscribeOrders() {
    if (!pharmacyId) return () => {};

    const q = query(
      collection(db, "orders"),
      where("pharmacyId", "==", pharmacyId)
    );

    return onSnapshot(q, (snap) => {
      setOrders(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });
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

      const conflict = snap.docs.find(
        (d) => d.data().status && d.data().status !== "DELIVERED"
      );

      if (conflict) {
        setError(
          "One or more selected pumps are already assigned to an active order."
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
      p.pumpNumber.toLowerCase().includes(pumpSearch.toLowerCase()) &&
      !pumpIds.includes(p.id)
  );

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

          <input
            value={pumpSearch}
            onChange={(e) => setPumpSearch(e.target.value)}
            placeholder="Search pump number..."
            className="w-full p-2 rounded bg-black border border-white/10"
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

          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full p-2 rounded bg-black border border-white/10"
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>

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

        {/* ORDERS LIST */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Orders</h2>

          <ul className="space-y-3">
            {orders.map((o) => (
              <li
                key={o.id}
                className="border border-white/10 rounded p-4 space-y-1"
              >
                <p className="font-medium">
                  Pumps: {o.pumpNumbers?.join(", ")} → {o.customerName}
                </p>

                <p className="text-xs">
                  Status:{" "}
                  <span
                    className={
                      o.status === "DELIVERED"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }
                  >
                    {o.status}
                  </span>
                </p>

                <p className="text-xs text-white/60">
                  Driver: {o.driverName || "—"}
                </p>

                <p className="text-xs text-white/50">
                  Last update: {formatDate(o.statusUpdatedAt || o.createdAt)}
                </p>

                {o.assignedAt && (
                  <p className="text-xs text-white/50">
                    Assigned: {formatDate(o.assignedAt)}
                  </p>
                )}

                {(o.deliveredAt || o.deliveredAtISO) && (
                  <p className="text-xs text-white/40">
                    Delivered: {formatDate(o.deliveredAt || o.deliveredAtISO)}
                  </p>
                )}

                <p className="text-xs text-white/40">
                  Created: {formatDate(o.createdAt)}
                </p>
              </li>
            ))}
          </ul>
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
