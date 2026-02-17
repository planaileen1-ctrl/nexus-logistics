/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Pump Maintenance
 * Track cleaning, calibration, and inspection
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
  serverTimestamp,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import AdminModeBadge from "@/components/AdminModeBadge";

type Pump = {
  id: string;
  pumpNumber: string;
  maintenanceDue?: boolean;
  maintenanceStatus?: {
    cleaned?: boolean;
    calibrated?: boolean;
    inspected?: boolean;
  };
};

export default function PumpMaintenancePage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const isPharmacyAdmin =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_ROLE") === "PHARMACY_ADMIN"
      : false;

  const [allPumps, setAllPumps] = useState<Pump[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [pendingReturnPumpNumbers, setPendingReturnPumpNumbers] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe: null | (() => void) = null;
    let ordersUnsubscribe: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "pumps"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setAllPumps(list);
      });

      const ordersQ = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId)
      );

      ordersUnsubscribe = onSnapshot(ordersQ, (snap) => {
        const pending = new Set<string>();

        snap.docs.forEach((d) => {
          const order = d.data() as any;

          const returnedByCustomer = (order.previousPumpsStatus || [])
            .filter((entry: any) => entry?.returned === true)
            .map((entry: any) => String(entry?.pumpNumber || "").trim())
            .filter(Boolean);

          if (returnedByCustomer.length === 0) return;

          const returnedToPharmacy = new Set(
            (order.previousPumpsReturnToPharmacy || [])
              .filter((entry: any) => entry?.returnedToPharmacy === true)
              .map((entry: any) => String(entry?.pumpNumber || "").trim())
              .filter(Boolean)
          );

          returnedByCustomer.forEach((pumpNumber: string) => {
            if (!returnedToPharmacy.has(pumpNumber)) {
              pending.add(pumpNumber);
            }
          });
        });

        setPendingReturnPumpNumbers(pending);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
      if (ordersUnsubscribe) ordersUnsubscribe();
    };
  }, []);

  useEffect(() => {
    const filtered = allPumps.filter((p: any) => {
      if (p.maintenanceDue !== true) return false;
      const pumpNumber = String(p.pumpNumber || "").trim();
      if (!pumpNumber) return true;
      return !pendingReturnPumpNumbers.has(pumpNumber);
    });

    setPumps(filtered);
  }, [allPumps, pendingReturnPumpNumbers]);

  async function handleSave(pumpId: string) {
    setError("");
    setInfo("");
    setLoadingId(pumpId);

    try {
      const currentPump = pumps.find((pump) => pump.id === pumpId);
      const status = currentPump?.maintenanceStatus;
      const cleaned = status?.cleaned === true;
      const calibrated = status?.calibrated === true;
      const inspected = status?.inspected === true;
      const allDone = cleaned && calibrated && inspected;

      await updateDoc(doc(db, "pumps", pumpId), {
        status: allDone ? "AVAILABLE" : "IN_MAINTENANCE",
        maintenanceStatus: {
          cleaned,
          calibrated,
          inspected,
        },
        maintenanceDue: !allDone,
        maintenanceUpdatedAt: serverTimestamp(),
        maintenanceCompletedAt: allDone ? serverTimestamp() : null,
      });

      setInfo(allDone ? "Maintenance completed." : "Maintenance updated.");
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      console.error("handleSave maintenance error:", err);
      setError("Failed to update maintenance.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pump Maintenance</h1>
          <p className="text-sm text-white/60">
            Clean, calibrate, and inspect returned pumps
          </p>
          <AdminModeBadge />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {info && <p className="text-green-400 text-sm text-center">{info}</p>}

        <div className="space-y-4">
          {pumps.length === 0 && (
            <p className="text-sm text-white/60 text-center">
              No pumps need maintenance.
            </p>
          )}

          {pumps.map((pump) => {
            const status = pump.maintenanceStatus || {};
            return (
              <div
                key={pump.id}
                className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-3"
              >
                <p className="text-sm font-semibold">Pump #{pump.pumpNumber}</p>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={status.cleaned === true}
                      onChange={(e) =>
                        setPumps((prev) =>
                          prev.map((p) =>
                            p.id === pump.id
                              ? {
                                  ...p,
                                  maintenanceStatus: {
                                    ...(p.maintenanceStatus || {}),
                                    cleaned: e.target.checked,
                                  },
                                }
                              : p
                          )
                        )
                      }
                    />
                    Cleaned
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={status.calibrated === true}
                      onChange={(e) =>
                        setPumps((prev) =>
                          prev.map((p) =>
                            p.id === pump.id
                              ? {
                                  ...p,
                                  maintenanceStatus: {
                                    ...(p.maintenanceStatus || {}),
                                    calibrated: e.target.checked,
                                  },
                                }
                              : p
                          )
                        )
                      }
                    />
                    Calibrated
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={status.inspected === true}
                      onChange={(e) =>
                        setPumps((prev) =>
                          prev.map((p) =>
                            p.id === pump.id
                              ? {
                                  ...p,
                                  maintenanceStatus: {
                                    ...(p.maintenanceStatus || {}),
                                    inspected: e.target.checked,
                                  },
                                }
                              : p
                          )
                        )
                      }
                    />
                    Inspected
                  </label>
                </div>

                <button
                  type="button"
                  disabled={loadingId === pump.id}
                  onClick={() => handleSave(pump.id)}
                  className="text-xs px-3 py-2 bg-emerald-600 rounded disabled:opacity-50"
                >
                  {loadingId === pump.id ? "Saving..." : "Save Maintenance"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={() =>
              router.push(
                isPharmacyAdmin
                  ? "/pharmacy/dashboard"
                  : "/employee/dashboard"
              )
            }
            className="text-xs text-white/50 hover:text-white"
          >
            {isPharmacyAdmin ? "← Back to Pharmacy Dashboard" : "← Back to Employee Dashboard"}
          </button>
        </div>
      </div>
    </main>
  );
}
