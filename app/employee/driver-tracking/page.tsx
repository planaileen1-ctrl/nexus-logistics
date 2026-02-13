"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { Loader, MapPin, Radio } from "lucide-react";

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
  const [isLive, setIsLive] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();
      if (pharmacyId) {
        setupRealtimeTracking();
      }
    })();

    return () => {
      // Clean up listeners when component unmounts
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [pharmacyId]);

  function setupRealtimeTracking() {
    try {
      setLoading(true);
      setIsLive(true);

      // Set up Firestore realtime listener
      const q = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId),
        where("status", "in", [
          "ASSIGNED",
          "IN_PROGRESS",
          "ON_WAY_TO_PHARMACY",
          "ON_WAY_TO_CUSTOMER",
        ])
      );

      unsubscribeRef.current = onSnapshot(
        q,
        (snapshot) => {
          const driverLocations = new (globalThis.Map)<string, Driver>();

          snapshot.docs.forEach((doc) => {
            const order = doc.data();
            if (order.driverId && order.driverName) {
              if (!driverLocations.has(order.driverId)) {
                const latCandidate =
                  typeof order.driverLatitude === "number"
                    ? order.driverLatitude
                    : typeof order.deliveredLatitude === "number"
                    ? order.deliveredLatitude
                    : undefined;

                const lngCandidate =
                  typeof order.driverLongitude === "number"
                    ? order.driverLongitude
                    : typeof order.deliveredLongitude === "number"
                    ? order.deliveredLongitude
                    : undefined;

                driverLocations.set(order.driverId, {
                  id: order.driverId,
                  name: order.driverName,
                  status: order.status,
                  lastUpdate: order.statusUpdatedAt?.toMillis?.() || Date.now(),
                  lat: latCandidate,
                  lng: lngCandidate,
                });
              }
            }
          });

          setDrivers(Array.from(driverLocations.values()));
          setLoading(false);
        },
        (err) => {
          console.error("Firestore listener error:", err);
          setIsLive(false);
          setLoading(false);
        }
      );

      // Extra polling interval every 8 seconds to refresh UI
      updateIntervalRef.current = setInterval(() => {
        // Trigger a re-render to update timestamps and UI
        setDrivers((prev) => [...prev]);
      }, 8000);
    } catch (err) {
      console.error("Tracking setup error:", err);
      setIsLive(false);
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

  const getRelativeTime = (timestamp?: number) => {
    if (!timestamp) return "Unknown";
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ago`;
  };

  const statusLabel = (status?: string) => {
    switch (status) {
      case "ON_WAY_TO_CUSTOMER":
        return "On way to customer";
      case "ON_WAY_TO_PHARMACY":
        return "On way to pharmacy";
      case "IN_PROGRESS":
        return "In progress";
      case "ASSIGNED":
        return "Assigned";
      default:
        return "Unknown";
    }
  };

  const driversWithoutLocation = drivers.filter(
    (driver) => driver.lat === undefined || driver.lng === undefined
  );

  const showLocationPermissionWarning = !loading && drivers.length > 0 && driversWithoutLocation.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MapPin className="text-emerald-400" size={32} />
              <h1 className="text-3xl font-bold text-white">Real-Time Driver Tracking</h1>
              {isLive && (
                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1 ml-auto">
                  <Radio size={12} className="text-red-400 animate-pulse" />
                  <span className="text-xs font-bold text-red-300 tracking-widest uppercase">LIVE</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Monitoring {drivers.length} active driver{drivers.length !== 1 ? 's' : ''} • Updates every 8 seconds
          </p>
        </div>

        {/* MAP */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 p-6">
          {showLocationPermissionWarning && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p className="text-xs text-amber-300 font-semibold">
                Location permission required for one or more drivers.
              </p>
              <p className="text-xs text-amber-200/80 mt-1">
                Ask drivers to enable GPS/location in their browser and update their order status.
              </p>
            </div>
          )}

          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader className="animate-spin text-emerald-400 mx-auto mb-2" size={40} />
                <p className="text-sm text-slate-400">Connecting to live tracking...</p>
                <div className="flex items-center justify-center gap-1 text-xs text-emerald-400">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span>Real-time updates active</span>
                </div>
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
          <h2 className="text-lg font-bold flex items-center gap-2">
            Active Drivers ({drivers.length})
            {isLive && <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
          </h2>
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
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2`}>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(driver.status)}`} />
                      <p className="text-sm text-slate-300">
                        {statusLabel(driver.status)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-400 font-semibold">
                        {getRelativeTime(driver.lastUpdate)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {driver.lastUpdate ? new Date(driver.lastUpdate).toLocaleTimeString("en-US") : "N/A"}
                      </p>
                    </div>
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
