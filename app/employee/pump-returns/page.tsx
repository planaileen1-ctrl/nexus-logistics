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
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

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

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pump Returns</h1>
          <p className="text-sm text-white/60">
            Track return status and reasons for non-returned pumps
          </p>
        </div>

        <div className="space-y-4">
          {orders.length === 0 && (
            <p className="text-sm text-white/60 text-center">
              No return records yet.
            </p>
          )}

          {orders.map((o) => (
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
