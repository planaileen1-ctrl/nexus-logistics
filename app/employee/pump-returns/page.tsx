/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Pump Returns
 * Track return status and reasons
 *
 * Last verified: 2026-02-13
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { normalizePumpScannerInput } from "@/lib/pumpScanner";

type ReturnOrder = {
  id: string;
  customerName: string;
  customerId: string;
  pumpNumbers?: string[];
  customerPreviousPumps?: string[];
  previousPumps?: string[];
  previousPumpsStatus?: { pumpNumber: string; returned: boolean; reason?: string }[];
  previousPumpsReturned?: boolean | null;
  previousPumpsReturnReason?: string;
  previousPumpsReturnToPharmacy?: {
    pumpNumber: string;
    returnedToPharmacy: boolean;
  }[];
  driverName?: string;
  status?: string;
  statusUpdatedAt?: any;
  createdAt?: any;
};

function formatDate(ts: any) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("en-US");
  if (ts?.toDate) return ts.toDate().toLocaleString("en-US");
  return "—";
}

export default function PumpReturnsPage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const [orders, setOrders] = useState<ReturnOrder[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "returned">("all");
  const [pumpSearch, setPumpSearch] = useState("");

  useEffect(() => {
    let unsubscribe: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
          .filter((o) =>
            (o.customerPreviousPumps || o.previousPumps || []).length > 0 ||
            (o.previousPumpsStatus || []).length > 0
          );

        setOrders(list);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  function isPumpReturnedToPharmacy(order: ReturnOrder, pumpNumber: string) {
    const entry = (order.previousPumpsReturnToPharmacy || []).find(
      (item) => String(item.pumpNumber) === String(pumpNumber)
    );

    return entry?.returnedToPharmacy === true;
  }

  const sortedOrders = [...orders].sort((a, b) => {
    const toMs = (ts: any) => {
      if (!ts) return 0;
      if (typeof ts === "string") return new Date(ts).getTime();
      if (ts?.toDate) return ts.toDate().getTime();
      return 0;
    };

    return toMs(b.statusUpdatedAt || b.createdAt) - toMs(a.statusUpdatedAt || a.createdAt);
  });

  const filteredByPump = sortedOrders.filter((order) => {
    const normalizedSearch = normalizePumpScannerInput(pumpSearch);
    if (!normalizedSearch) return true;

    const previous = order.previousPumps || order.customerPreviousPumps || [];
    const statusNumbers = (order.previousPumpsStatus || []).map((entry) => entry.pumpNumber);
    const all = [...previous, ...statusNumbers];

    return all.some((num) =>
      String(num).toUpperCase().includes(normalizedSearch)
    );
  });

  const filteredOrders = filteredByPump.filter((order) => {
    if (filter === "all") return true;

    const pumps = order.previousPumpsStatus || [];
    if (pumps.length === 0) return false;

    const allReturned = pumps.every((entry) =>
      isPumpReturnedToPharmacy(order, entry.pumpNumber)
    );
    const anyPending = pumps.some(
      (entry) => !isPumpReturnedToPharmacy(order, entry.pumpNumber)
    );

    if (filter === "returned") return allReturned;
    return anyPending;
  });

  const counts = {
    all: sortedOrders.length,
    pending: sortedOrders.filter((order) => {
      const pumps = order.previousPumpsStatus || [];
      if (pumps.length === 0) return false;
      return pumps.some((entry) => !isPumpReturnedToPharmacy(order, entry.pumpNumber));
    }).length,
    returned: sortedOrders.filter((order) => {
      const pumps = order.previousPumpsStatus || [];
      if (pumps.length === 0) return false;
      return pumps.every((entry) => isPumpReturnedToPharmacy(order, entry.pumpNumber));
    }).length,
  };

  async function handleConfirmReturn(order: ReturnOrder, pumpNumber: string) {
    if (!pharmacyId) return;

    setError("");
    setInfo("");
    setLoadingId(`${order.id}-${pumpNumber}`);

    try {
      const updated = [...(order.previousPumpsReturnToPharmacy || [])];
      const idx = updated.findIndex(
        (item) => String(item.pumpNumber) === String(pumpNumber)
      );

      if (idx >= 0) {
        updated[idx] = {
          pumpNumber: String(pumpNumber),
          returnedToPharmacy: true,
        };
      } else {
        updated.push({
          pumpNumber: String(pumpNumber),
          returnedToPharmacy: true,
        });
      }

      await updateDoc(doc(db, "orders", order.id), {
        previousPumpsReturnToPharmacy: updated,
        statusUpdatedAt: serverTimestamp(),
      });

      const pumpQuery = query(
        collection(db, "pumps"),
        where("pharmacyId", "==", pharmacyId),
        where("pumpNumber", "==", String(pumpNumber))
      );

      const pumpSnap = await getDocs(pumpQuery);
      if (!pumpSnap.empty) {
        const pumpDoc = pumpSnap.docs[0];
        await updateDoc(doc(db, "pumps", pumpDoc.id), {
          status: "IN_MAINTENANCE",
          maintenanceDue: true,
          maintenanceDueAt: serverTimestamp(),
          maintenanceStatus: {
            cleaned: false,
            calibrated: false,
            inspected: false,
          },
        });
      }

      setInfo("Return confirmed.");
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      console.error("handleConfirmReturn error:", err);
      setError("Failed to confirm return.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pump Returns</h1>
          <p className="text-sm text-white/60">
            Track return status and reasons for non-returned pumps
          </p>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {info && <p className="text-green-400 text-sm text-center">{info}</p>}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <input
            value={pumpSearch}
            onChange={(e) => setPumpSearch(e.target.value)}
            placeholder="Search pump (type or scan barcode/QR)..."
            className="w-full max-w-md px-3 py-2 rounded bg-black/30 border border-white/10 text-xs"
          />

          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1 rounded border ${
              filter === "all"
                ? "bg-white/20 border-white/30"
                : "bg-black/30 border-white/10"
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`text-xs px-3 py-1 rounded border ${
              filter === "pending"
                ? "bg-amber-500/20 border-amber-400/40"
                : "bg-black/30 border-white/10"
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setFilter("returned")}
            className={`text-xs px-3 py-1 rounded border ${
              filter === "returned"
                ? "bg-emerald-500/20 border-emerald-400/40"
                : "bg-black/30 border-white/10"
            }`}
          >
            Returned ({counts.returned})
          </button>
        </div>

        <div className="space-y-4">
          {filteredOrders.length === 0 && (
            <p className="text-sm text-white/60 text-center">
              No return records yet.
            </p>
          )}

          {filteredOrders.map((o) => (
            <div
              key={o.id}
              className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-2"
            >
              <p className="text-sm font-semibold">
                {o.customerName} — Order {o.id}
              </p>
              <p className="text-xs text-white/60">
                Driver: {o.driverName || "Unassigned"}
              </p>
              <p className="text-xs text-white/50">
                Last update: {formatDate(o.statusUpdatedAt || o.createdAt)}
              </p>

              <div className="space-y-1">
                <p className="text-xs text-white/60">Previous pumps</p>
                <p className="text-xs">
                  {(o.previousPumps || o.customerPreviousPumps || []).join(", ") || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-white/60">Return status</p>
                {o.previousPumpsStatus && o.previousPumpsStatus.length > 0 ? (
                  <div className="space-y-2">
                    {o.previousPumpsStatus.map((entry) => (
                      <div
                        key={entry.pumpNumber}
                        className="border border-white/10 rounded p-2"
                      >
                        <p className="text-xs">
                          Pump #{entry.pumpNumber}: {entry.returned ? "Returned" : "Not returned"}
                        </p>
                        {!entry.returned && (
                          <p className="text-xs text-white/80">
                            Reason: {entry.reason || "—"}
                          </p>
                        )}

                        {entry.returned && (
                          <div className="mt-2">
                            {isPumpReturnedToPharmacy(o, entry.pumpNumber) ? (
                              <p className="text-xs text-green-400">
                                Returned to pharmacy
                              </p>
                            ) : (
                              <button
                                type="button"
                                disabled={loadingId === `${o.id}-${entry.pumpNumber}`}
                                onClick={() => handleConfirmReturn(o, entry.pumpNumber)}
                                className="text-xs px-3 py-1 bg-amber-600 rounded disabled:opacity-50"
                              >
                                Mark returned to pharmacy
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs">
                    {o.previousPumpsReturned === true && "Returned"}
                    {o.previousPumpsReturned === false && "Not returned"}
                    {o.previousPumpsReturned == null && "Pending"}
                  </p>
                )}
              </div>
            </div>
          ))}
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
