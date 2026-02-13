"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { Loader, MapPin } from "lucide-react";

/* ========================
   MAP COMPONENT (Dynamic)
======================== */
const MapComponent = dynamic(() => import("@/components/MapDriver"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-slate-900 rounded-lg flex items-center justify-center">
      <Loader className="animate-spin text-emerald-400" size={32} />
    </div>
  ),
});

type Driver = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  status?: string;
  lastUpdate?: number;
};

export default function DriverTrackingPage() {
  const pharmacyId =
    typeof window !== "undefined" ? localStorage.getItem("PHARMACY_ID") : null;

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();
      if (pharmacyId) loadDrivers();
    })();
  }, []);

  async function loadDrivers() {
    try {
      setLoading(true);
      const ordersSnap = await getDocs(
        query(
          collection(db, "orders"),
          where("pharmacyId", "==", pharmacyId),
          where("status", "in", [
            "ASSIGNED",
            "IN_PROGRESS",
            "ON_WAY_TO_PHARMACY",
            "ON_WAY_TO_CUSTOMER",
          ])
        )
      );

      const driverLocations = new (globalThis.Map)<string, Driver>();

      ordersSnap.docs.forEach((doc) => {
        const order = doc.data();
        if (order.driverId && order.driverName) {
          if (!driverLocations.has(order.driverId)) {
            driverLocations.set(order.driverId, {
              id: order.driverId,
              name: order.driverName,
              status: order.status,
              lastUpdate: order.statusUpdatedAt?.toMillis?.() || Date.now(),
              lat: order.deliveredLatitude || 40.7128,
              lng: order.deliveredLongitude || -74.006,
            });
          }
        }
      });

      setDrivers(Array.from(driverLocations.values()));
    } catch (err) {
      console.error("Error loading drivers:", err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ON_WAY_TO_CUSTOMER":
        return "bg-blue-500";
      case "ON_WAY_TO_PHARMACY":
        return "bg-orange-500";
      case "IN_PROGRESS":
        return "bg-yellow-500";
      case "ASSIGNED":
        return "bg-emerald-500";
      default:
        return "bg-slate-500";
    }
  };

  const statusLabel = (status?: string) => {
    switch (status) {
      case "ON_WAY_TO_CUSTOMER":
        return "En ruta al cliente";
      case "ON_WAY_TO_PHARMACY":
        return "En ruta a farmacia";
      case "IN_PROGRESS":
        return "En entrega";
      case "ASSIGNED":
        return "Asignado";
      default:
        return "Desconocido";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <MapPin className="text-emerald-400" size={28} />
            Real-Time Driver Tracking
          </h1>
          <p className="text-sm text-slate-400">
            Monitor active drivers and their deliveries in real-time
          </p>
        </div>

        {/* MAP */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 p-6">
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <Loader className="animate-spin text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Loading map...</p>
              </div>
            </div>
          ) : drivers.length > 0 ? (
            <MapComponent drivers={drivers} />
          ) : (
            <div className="h-96 flex items-center justify-center text-slate-400">
              <p>No active drivers at this moment</p>
            </div>
          )}
        </div>

        {/* DRIVERS LIST */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Active Drivers ({drivers.length})</h2>
          {drivers.length === 0 ? (
            <div className="bg-slate-800/30 rounded-lg p-4 text-center text-slate-400 text-sm">
              No drivers currently active
            </div>
          ) : (
            <div className="grid gap-3">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="bg-gradient-to-r from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{driver.name}</p>
                    <p className="text-xs text-slate-400">ID: {driver.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2`}>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(driver.status)}`} />
                      <p className="text-sm text-slate-300">
                        {statusLabel(driver.status)}
                      </p>
                    </div>
                    {driver.lastUpdate && (
                      <p className="text-xs text-slate-500">
                        {new Date(driver.lastUpdate).toLocaleTimeString("en-US")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BACK BUTTON */}
        <div className="text-center pt-4">
          <button
            onClick={() => window.history.back()}
            className="text-sm text-slate-500 hover:text-emerald-400 transition-colors font-semibold uppercase tracking-wide"
          >
            ← Back
          </button>
        </div>
      </div>
    </main>
  );
}
