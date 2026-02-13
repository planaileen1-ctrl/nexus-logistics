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

  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "pumps"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((p) => p.maintenanceDue === true);

        setPumps(list);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function handleSave(pumpId: string, status: Pump["maintenanceStatus"]) {
    setError("");
    setInfo("");
    setLoadingId(pumpId);

    try {
      const cleaned = status?.cleaned === true;
      const calibrated = status?.calibrated === true;
      const inspected = status?.inspected === true;
      const allDone = cleaned && calibrated && inspected;

      await updateDoc(doc(db, "pumps", pumpId), {
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
                                    ...status,
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
                                    ...status,
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
                                    ...status,
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
                  onClick={() => handleSave(pump.id, pump.maintenanceStatus)}
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
