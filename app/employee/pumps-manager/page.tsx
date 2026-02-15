/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Pump Out (Clients)
 * View customers holding pumps for long periods and send notifications
 *
 * Last verified: 2026-02-14
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { sendAppEmail } from "@/lib/emailClient";

type Customer = {
  id: string;
  name: string;
  city?: string;
  email?: string;
};

type Order = {
  id: string;
  customerId?: string;
  status?: string;
  pumpNumbers?: string[];
  deliveredAt?: any;
  deliveredAtISO?: string;
  statusUpdatedAt?: any;
  createdAt?: any;
  driverName?: string;
  receivedByName?: string;
  previousPumpsStatus?: { pumpNumber: string; returned: boolean; reason?: string }[];
  previousPumps?: string[];
  previousPumpsReturned?: boolean | null;
  previousPumpsReturnToPharmacy?: {
    pumpNumber: string;
    returnedToPharmacy: boolean;
  }[];
};

type OutstandingPump = {
  pumpNumber: string;
  orderId: string;
  deliveredAt?: any;
  deliveredAtISO?: string;
  driverName?: string;
  receivedByName?: string;
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

function toMs(ts: any) {
  if (!ts) return 0;
  if (typeof ts === "string") return new Date(ts).getTime();
  if (ts?.toDate) return ts.toDate().getTime();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function formatDateTime(ts: any, iso?: string) {
  if (ts?.toDate) return ts.toDate().toLocaleString("en-US", DATE_TIME_FORMAT);
  if (typeof ts === "string") return new Date(ts).toLocaleString("en-US", DATE_TIME_FORMAT);
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString("en-US", DATE_TIME_FORMAT);
  if (iso) return new Date(iso).toLocaleString("en-US", DATE_TIME_FORMAT);
  return "—";
}

function getDaysOut(ts: any, iso?: string) {
  const ms = toMs(ts) || toMs(iso);
  if (!ms) return 0;
  const diff = Date.now() - ms;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getAgeColorClass(daysOut: number) {
  if (daysOut >= 30) return "text-red-400";
  if (daysOut >= 20) return "text-yellow-300";
  return "text-green-300";
}

export default function PumpsManagerPage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [viewFilter, setViewFilter] = useState<"ALL" | "OVERDUE_20" | "OVERDUE_30">("ALL");
  const [sendingByPumpKey, setSendingByPumpKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      try {
        await ensureAnonymousAuth();

        if (!pharmacyId) {
          setError("Missing pharmacy context.");
          return;
        }

        const [customersSnap, ordersSnap] = await Promise.all([
          getDocs(
            query(collection(db, "customers"), where("pharmacyId", "==", pharmacyId))
          ),
          getDocs(
            query(collection(db, "orders"), where("pharmacyId", "==", pharmacyId))
          ),
        ]);

        setCustomers(
          customersSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().customerName,
            city: d.data().city,
            email: d.data().email,
          }))
        );

        setOrders(
          ordersSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
      } catch (err) {
        console.error("pumps-manager load error:", err);
        setError("Failed to load customer pumps.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pharmacyId]);

  const customerWithOutstandingPumps = useMemo(() => {
    const sortedOrders = [...orders].sort((a, b) => {
      const aTime = toMs(a.deliveredAt) || toMs(a.deliveredAtISO) || toMs(a.createdAt);
      const bTime = toMs(b.deliveredAt) || toMs(b.deliveredAtISO) || toMs(b.createdAt);
      return aTime - bTime;
    });

    const byCustomer = new Map<string, Map<string, OutstandingPump>>();

    sortedOrders.forEach((order) => {
      const customerId = String(order.customerId || "").trim();
      if (!customerId) return;

      if (!byCustomer.has(customerId)) {
        byCustomer.set(customerId, new Map<string, OutstandingPump>());
      }

      const pumpMap = byCustomer.get(customerId)!;
      const rawStatus = String(order.status || "").trim().toUpperCase();
      const isDelivered = rawStatus === "DELIVERED" || !!order.deliveredAt || !!order.deliveredAtISO;

      if (isDelivered) {
        (order.pumpNumbers || []).forEach((num) => {
          const pumpNumber = String(num || "").trim();
          if (!pumpNumber) return;

          pumpMap.set(pumpNumber, {
            pumpNumber,
            orderId: order.id,
            deliveredAt: order.deliveredAt,
            deliveredAtISO: order.deliveredAtISO,
            driverName: order.driverName,
            receivedByName: order.receivedByName,
          });
        });
      }

      (order.previousPumpsStatus || [])
        .filter((entry) => entry.returned)
        .forEach((entry) => {
          const pumpNumber = String(entry.pumpNumber || "").trim();
          if (pumpNumber) pumpMap.delete(pumpNumber);
        });

      if (order.previousPumpsReturned === true) {
        (order.previousPumps || []).forEach((num) => {
          const pumpNumber = String(num || "").trim();
          if (pumpNumber) pumpMap.delete(pumpNumber);
        });
      }

      (order.previousPumpsReturnToPharmacy || [])
        .filter((entry) => entry.returnedToPharmacy)
        .forEach((entry) => {
          const pumpNumber = String(entry.pumpNumber || "").trim();
          if (pumpNumber) pumpMap.delete(pumpNumber);
        });
    });

    return Array.from(byCustomer.entries())
      .map(([customerId, pumpMap]) => {
        const customer = customers.find((c) => c.id === customerId);
        const pumps = Array.from(pumpMap.values()).sort(
          (a, b) =>
            (toMs(b.deliveredAt) || toMs(b.deliveredAtISO)) -
            (toMs(a.deliveredAt) || toMs(a.deliveredAtISO))
        );

        return {
          customerId,
          customerName: customer?.name || "Unknown Customer",
          customerCity: customer?.city || "",
          customerEmail: customer?.email || "",
          pumps,
        };
      })
      .filter((entry) => entry.pumps.length > 0)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customers, orders]);

  const totalOutstandingPumps = customerWithOutstandingPumps.reduce(
    (count, entry) => count + entry.pumps.length,
    0
  );

  const totalOverduePumps = customerWithOutstandingPumps.reduce(
    (count, entry) =>
      count +
      entry.pumps.filter((pump) => getDaysOut(pump.deliveredAt, pump.deliveredAtISO) >= 30)
        .length,
    0
  );

  const visibleCustomers = customerWithOutstandingPumps.filter((entry) => {
    if (viewFilter === "ALL") return true;

    if (viewFilter === "OVERDUE_20") {
      return entry.pumps.some(
        (pump) => getDaysOut(pump.deliveredAt, pump.deliveredAtISO) >= 20
      );
    }

    return entry.pumps.some(
      (pump) => getDaysOut(pump.deliveredAt, pump.deliveredAtISO) >= 30
    );
  });

  const selectedCustomer = visibleCustomers.find(
    (entry) => entry.customerId === selectedCustomerId
  );

  useEffect(() => {
    if (!selectedCustomerId) return;

    const stillVisible = visibleCustomers.some(
      (entry) => entry.customerId === selectedCustomerId
    );

    if (!stillVisible) {
      setSelectedCustomerId("");
    }
  }, [visibleCustomers, selectedCustomerId]);

  async function handleSendOverdueNotice(
    customerName: string,
    customerEmail: string,
    pump: OutstandingPump
  ) {
    if (!customerEmail) {
      setError("Customer email is missing.");
      return;
    }

    const pumpKey = `${selectedCustomerId}-${pump.pumpNumber}`;

    setError("");
    setInfo("");
    setSendingByPumpKey((prev) => ({ ...prev, [pumpKey]: true }));

    try {
      const daysOut = getDaysOut(pump.deliveredAt, pump.deliveredAtISO);
      const deliveredAtLabel = formatDateTime(pump.deliveredAt, pump.deliveredAtISO);

      await sendAppEmail({
        to: customerEmail,
        subject: `Pump Return Notice - Pump ${pump.pumpNumber}`,
        html: `
          <p>Hello ${customerName},</p>
          <p>This is a return reminder for pump <strong>${pump.pumpNumber}</strong>.</p>
          <p><strong>Delivered:</strong> ${deliveredAtLabel}</p>
          <p><strong>Days with client:</strong> ${daysOut}</p>
          <p><strong>Driver:</strong> ${pump.driverName || "Not assigned"}</p>
          <p><strong>Received by:</strong> ${pump.receivedByName || "Not recorded"}</p>
          <p>Please coordinate return as soon as possible.</p>
        `,
        text: `Pump return reminder for ${pump.pumpNumber}. Delivered: ${deliveredAtLabel}. Days with client: ${daysOut}. Driver: ${pump.driverName || "Not assigned"}. Received by: ${pump.receivedByName || "Not recorded"}. Please coordinate return as soon as possible.`,
      });

      setInfo(`Notification sent for pump ${pump.pumpNumber}.`);
      setTimeout(() => setInfo(""), 5000);
    } catch (err) {
      console.error("send overdue notice error:", err);
      setError("Failed to send customer notification.");
    } finally {
      setSendingByPumpKey((prev) => ({ ...prev, [pumpKey]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-6xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pump Out (Clients)</h1>
          <p className="text-sm text-white/60">
            Customers with pumps not returned for long periods
          </p>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {info && <p className="text-green-400 text-sm text-center">{info}</p>}

        {!loading && customerWithOutstandingPumps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-white/50">Outstanding Pumps</p>
              <p className="text-2xl font-bold text-cyan-200 mt-2">{totalOutstandingPumps}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-red-200/80">Overdue 30+ Days</p>
              <p className="text-2xl font-bold text-red-300 mt-2">{totalOverduePumps}</p>
            </div>
          </div>
        )}

        {!loading && customerWithOutstandingPumps.length > 0 && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setViewFilter("ALL")}
              className={`text-xs px-3 py-1 rounded border ${
                viewFilter === "ALL"
                  ? "bg-white/15 border-white/40"
                  : "bg-black/30 border-white/20 hover:border-white/40"
              }`}
            >
              All Customers
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("OVERDUE_20")}
              className={`text-xs px-3 py-1 rounded border ${
                viewFilter === "OVERDUE_20"
                  ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-200"
                  : "bg-black/30 border-white/20 hover:border-white/40"
              }`}
            >
              20+ Days
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("OVERDUE_30")}
              className={`text-xs px-3 py-1 rounded border ${
                viewFilter === "OVERDUE_30"
                  ? "bg-red-500/20 border-red-400/50 text-red-200"
                  : "bg-black/30 border-white/20 hover:border-white/40"
              }`}
            >
              30+ Days Only
            </button>
          </div>
        )}

        {loading && (
          <p className="text-sm text-white/60 text-center">Loading customer cards...</p>
        )}

        {!loading && customerWithOutstandingPumps.length === 0 && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-sm text-white/70">No customers with outstanding pumps.</p>
          </div>
        )}

        {!loading && customerWithOutstandingPumps.length > 0 && visibleCustomers.length === 0 && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-sm text-white/70">No customers found for this filter.</p>
          </div>
        )}

        {!loading && visibleCustomers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleCustomers.map((entry) => (
              <button
                key={entry.customerId}
                type="button"
                onClick={() => setSelectedCustomerId(entry.customerId)}
                className="text-left rounded-xl border border-white/10 bg-black/30 p-4 transition-colors hover:border-white/30"
              >
                <p className="text-base font-semibold">{entry.customerName}</p>
                <p className="text-xs text-white/60">{entry.customerCity || "—"}</p>
                <p className="text-xs text-cyan-200 mt-2">
                  Outstanding pumps: {entry.pumps.length}
                </p>
              </button>
            ))}
          </div>
        )}

        {selectedCustomer && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center px-4 z-50"
            onClick={() => setSelectedCustomerId("")}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#020617] border border-white/10 rounded-xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selectedCustomer.customerName}</h2>
                  <p className="text-xs text-white/60">
                    Outstanding pumps list ({selectedCustomer.pumps.length})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId("")}
                  className="text-xs px-3 py-1 rounded border border-white/20 hover:border-white/40"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {selectedCustomer.pumps.map((pump) => {
                  const daysOut = getDaysOut(pump.deliveredAt, pump.deliveredAtISO);
                  const ageClass = getAgeColorClass(daysOut);
                  const pumpKey = `${selectedCustomer.customerId}-${pump.pumpNumber}`;
                  const isOverdue = daysOut >= 30;

                  return (
                    <div
                      key={pumpKey}
                      className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-1"
                    >
                      <p className="text-sm font-semibold">Pump #{pump.pumpNumber}</p>
                      <p className={`text-xs ${ageClass}`}>
                        Delivery Date/Time: {formatDateTime(pump.deliveredAt, pump.deliveredAtISO)}
                      </p>
                      <p className={`text-xs ${ageClass}`}>Days Out: {daysOut}</p>
                      <p className="text-xs text-white/70">
                        Driver: {pump.driverName || "Not assigned"}
                      </p>
                      <p className="text-xs text-white/70">
                        Received by: {pump.receivedByName || "Not recorded"}
                      </p>

                      {isOverdue && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSendOverdueNotice(
                              selectedCustomer.customerName,
                              selectedCustomer.customerEmail,
                              pump
                            )
                          }
                          disabled={sendingByPumpKey[pumpKey] === true}
                          className="mt-2 px-3 py-2 text-xs rounded bg-red-600 hover:bg-red-500 disabled:opacity-50"
                        >
                          📸 Send Return Notification
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
