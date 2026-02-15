"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import PharmacyAdminFrame from "@/components/PharmacyAdminFrame";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

type EmployeeItem = {
  id: string;
  name: string;
};

type OrderDoc = {
  id: string;
  createdByEmployeeId?: string;
  createdByEmployeeName?: string;
  driverName?: string;
  pumpNumbers?: string[];
  createdAt?: any;
  deliveredAt?: any;
  deliveredAtISO?: string;
  statusUpdatedAt?: any;
  previousPumpsStatus?: { pumpNumber: string; returned: boolean; reason?: string }[];
  previousPumpsReturnToPharmacy?: { pumpNumber: string; returnedToPharmacy: boolean }[];
};

type PumpMovement = {
  orderId: string;
  pumpNumber: string;
  driverName: string;
  sentAt?: any;
  deliveredAt?: any;
  collectedAt?: any;
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

function toMillis(ts: any) {
  if (!ts) return 0;
  if (typeof ts === "string") return new Date(ts).getTime();
  if (ts?.toDate) return ts.toDate().getTime();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function formatUsDateTime(ts: any) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("en-US", DATE_TIME_FORMAT);
  if (ts?.toDate) return ts.toDate().toLocaleString("en-US", DATE_TIME_FORMAT);
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString("en-US", DATE_TIME_FORMAT);
  return "—";
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }

  return value;
}

export default function PharmacyEmployeeOperationsPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dateRange, setDateRange] = useState<"ALL" | "TODAY" | "7D" | "30D" | "90D">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function isWithinRange(ms: number) {
    if (!ms || dateRange === "ALL") return true;

    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;

    if (dateRange === "TODAY") {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      return ms >= startOfDay;
    }

    const days = dateRange === "7D" ? 7 : dateRange === "30D" ? 30 : 90;
    return ms >= now - days * oneDay;
  }

  useEffect(() => {
    let unsubEmployees: null | (() => void) = null;
    let unsubOrders: null | (() => void) = null;

    (async () => {
      try {
        await ensureAnonymousAuth();
        const pharmacyId = localStorage.getItem("PHARMACY_ID");

        if (!pharmacyId) {
          setError("Missing pharmacy context.");
          setLoading(false);
          return;
        }

        const employeesQuery = query(
          collection(db, "employees"),
          where("pharmacyId", "==", pharmacyId),
          where("active", "==", true)
        );

        const ordersQuery = query(
          collection(db, "orders"),
          where("pharmacyId", "==", pharmacyId)
        );

        unsubEmployees = onSnapshot(
          employeesQuery,
          (snap) => {
            const list: EmployeeItem[] = snap.docs
              .map((doc) => {
                const data = doc.data() as any;
                return {
                  id: doc.id,
                  name: String(data.fullName || "").trim(),
                };
              })
              .filter((e) => e.name.length > 0)
              .sort((a, b) => a.name.localeCompare(b.name));

            setEmployees(list);
            setLoading(false);
          },
          (err) => {
            console.error("employee operations employees listener error:", err);
            setError("Failed to load employees.");
            setLoading(false);
          }
        );

        unsubOrders = onSnapshot(
          ordersQuery,
          (snap) => {
            const list = snap.docs
              .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
              .sort((a, b) => {
                const aTime = toMillis(a.createdAt) || toMillis(a.statusUpdatedAt);
                const bTime = toMillis(b.createdAt) || toMillis(b.statusUpdatedAt);
                return bTime - aTime;
              }) as OrderDoc[];

            setOrders(list);
          },
          (err) => {
            console.error("employee operations orders listener error:", err);
            setError("Failed to load order movements.");
          }
        );
      } catch (err) {
        console.error("employee operations init error:", err);
        setError("Failed to initialize page.");
        setLoading(false);
      }
    })();

    return () => {
      if (unsubEmployees) unsubEmployees();
      if (unsubOrders) unsubOrders();
    };
  }, []);

  const mergedEmployees = useMemo(() => {
    const fromOrders = orders
      .map((order) => ({
        id: String(order.createdByEmployeeId || "").trim(),
        name: String(order.createdByEmployeeName || "").trim(),
      }))
      .filter((e) => e.name.length > 0);

    const map = new Map<string, EmployeeItem>();

    employees.forEach((employee) => {
      const key = employee.id || employee.name;
      map.set(key, employee);
    });

    fromOrders.forEach((employee) => {
      const key = employee.id || employee.name;
      if (!map.has(key)) {
        map.set(key, {
          id: employee.id || employee.name,
          name: employee.name,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, orders]);

  useEffect(() => {
    if (!selectedEmployeeId && mergedEmployees.length > 0) {
      setSelectedEmployeeId(mergedEmployees[0].id || mergedEmployees[0].name);
      return;
    }

    if (
      selectedEmployeeId &&
      mergedEmployees.length > 0 &&
      !mergedEmployees.some((employee) => (employee.id || employee.name) === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(mergedEmployees[0].id || mergedEmployees[0].name);
    }
  }, [mergedEmployees, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toUpperCase();
    if (!search) return mergedEmployees;

    return mergedEmployees.filter((employee) =>
      employee.name.toUpperCase().includes(search)
    );
  }, [mergedEmployees, employeeSearch]);

  const selectedEmployee = filteredEmployees.find(
    (employee) => (employee.id || employee.name) === selectedEmployeeId
  ) || mergedEmployees.find((employee) => (employee.id || employee.name) === selectedEmployeeId);

  const employeeOrders = useMemo(() => {
    if (!selectedEmployee) return [];

    return orders.filter((order) => {
      const byId =
        selectedEmployee.id &&
        String(order.createdByEmployeeId || "").trim() === String(selectedEmployee.id).trim();

      const byName =
        String(order.createdByEmployeeName || "").trim().toUpperCase() ===
        String(selectedEmployee.name || "").trim().toUpperCase();

      return byId || byName;
    });
  }, [orders, selectedEmployee]);

  const sentMovements = useMemo<PumpMovement[]>(() => {
    const rows: PumpMovement[] = [];

    employeeOrders.forEach((order) => {
      (order.pumpNumbers || []).forEach((pumpNumber) => {
        rows.push({
          orderId: order.id,
          pumpNumber: String(pumpNumber || "").trim(),
          driverName: String(order.driverName || "Unassigned"),
          sentAt: order.createdAt,
          deliveredAt: order.deliveredAt || order.deliveredAtISO,
        });
      });
    });

    return rows.sort((a, b) => (toMillis(b.sentAt) || toMillis(b.deliveredAt)) - (toMillis(a.sentAt) || toMillis(a.deliveredAt)));
  }, [employeeOrders]);

  const collectedMovements = useMemo<PumpMovement[]>(() => {
    const rows: PumpMovement[] = [];

    employeeOrders.forEach((order) => {
      const returnedSet = new Set(
        (order.previousPumpsStatus || [])
          .filter((entry) => entry.returned)
          .map((entry) => String(entry.pumpNumber || "").trim())
      );

      const returnedToPharmacySet = new Set(
        (order.previousPumpsReturnToPharmacy || [])
          .filter((entry) => entry.returnedToPharmacy)
          .map((entry) => String(entry.pumpNumber || "").trim())
      );

      returnedSet.forEach((pumpNumber) => {
        rows.push({
          orderId: order.id,
          pumpNumber,
          driverName: String(order.driverName || "Unassigned"),
          collectedAt: order.statusUpdatedAt,
          deliveredAt: returnedToPharmacySet.has(pumpNumber) ? order.statusUpdatedAt : null,
        });
      });
    });

    return rows.sort((a, b) => toMillis(b.collectedAt) - toMillis(a.collectedAt));
  }, [employeeOrders]);

  const visibleSentMovements = useMemo(
    () => sentMovements.filter((row) => isWithinRange(toMillis(row.sentAt) || toMillis(row.deliveredAt))),
    [sentMovements, dateRange]
  );

  const visibleCollectedMovements = useMemo(
    () => collectedMovements.filter((row) => isWithinRange(toMillis(row.collectedAt) || toMillis(row.deliveredAt))),
    [collectedMovements, dateRange]
  );

  const lastActivityMillis = useMemo(() => {
    const allMs = [
      ...visibleSentMovements.map((row) => toMillis(row.deliveredAt) || toMillis(row.sentAt)),
      ...visibleCollectedMovements.map((row) => toMillis(row.deliveredAt) || toMillis(row.collectedAt)),
    ].filter((ms) => ms > 0);

    if (allMs.length === 0) return 0;
    return Math.max(...allMs);
  }, [visibleSentMovements, visibleCollectedMovements]);

  function handleClearFilters() {
    setEmployeeSearch("");
    setDateRange("ALL");
  }

  function handleExportCsv() {
    if (!selectedEmployee) return;

    const rows: string[] = [];
    rows.push([
      "Type",
      "Employee",
      "Pump",
      "Driver",
      "Sent At (US)",
      "Delivered/Returned At (US)",
      "Order",
    ].join(","));

    visibleSentMovements.forEach((row) => {
      rows.push([
        "SENT",
        escapeCsvValue(selectedEmployee.name),
        escapeCsvValue(row.pumpNumber),
        escapeCsvValue(row.driverName),
        escapeCsvValue(formatUsDateTime(row.sentAt)),
        escapeCsvValue(formatUsDateTime(row.deliveredAt)),
        escapeCsvValue(row.orderId),
      ].join(","));
    });

    visibleCollectedMovements.forEach((row) => {
      rows.push([
        "COLLECTED",
        escapeCsvValue(selectedEmployee.name),
        escapeCsvValue(row.pumpNumber),
        escapeCsvValue(row.driverName),
        escapeCsvValue(formatUsDateTime(row.collectedAt)),
        escapeCsvValue(formatUsDateTime(row.deliveredAt)),
        escapeCsvValue(row.orderId),
      ].join(","));
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileName = `${selectedEmployee.name.replace(/\s+/g, "_")}_operations.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PharmacyAdminFrame title="Employee Operation" subtitle="Realtime activity by employee">
      <main className="min-h-screen bg-[#020617] text-white px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-black">Employee Operation</h1>
            <p className="text-sm text-white/60">
              Select an employee name to see sent and collected pump details in realtime.
            </p>
          </header>

          <div className="bg-black/30 border border-white/10 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Search Employee</label>
              <input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Type employee name..."
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as "ALL" | "TODAY" | "7D" | "30D" | "90D")}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="ALL">All time</option>
                <option value="TODAY">Today</option>
                <option value="7D">Last 7 days</option>
                <option value="30D">Last 30 days</option>
                <option value="90D">Last 90 days</option>
              </select>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs px-3 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/10"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!selectedEmployee}
                className="text-xs px-3 py-2 rounded border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <section className="lg:col-span-1 bg-black/30 border border-white/10 rounded-xl p-4">
              <h2 className="text-sm font-bold mb-3">Employee Names</h2>
              {loading && <p className="text-xs text-white/60">Loading employees...</p>}
              {!loading && filteredEmployees.length === 0 && (
                <p className="text-xs text-white/60">No employees found.</p>
              )}

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredEmployees.map((employee) => {
                  const key = employee.id || employee.name;
                  const selected = key === selectedEmployeeId;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedEmployeeId(key)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        selected
                          ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-100"
                          : "bg-black/30 border-white/10 text-white/80 hover:bg-white/5"
                      }`}
                    >
                      {employee.name}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <p className="text-[11px] text-white/60 uppercase tracking-wider">Total sent</p>
                  <p className="text-2xl font-black text-cyan-300 mt-1">{visibleSentMovements.length}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <p className="text-[11px] text-white/60 uppercase tracking-wider">Total collected</p>
                  <p className="text-2xl font-black text-amber-300 mt-1">{visibleCollectedMovements.length}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <p className="text-[11px] text-white/60 uppercase tracking-wider">Last activity (US)</p>
                  <p className="text-sm font-bold text-emerald-200 mt-2">{lastActivityMillis ? formatUsDateTime(lastActivityMillis) : "—"}</p>
                </div>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <h2 className="text-sm font-bold">
                  {selectedEmployee ? `Details · ${selectedEmployee.name}` : "Employee Details"}
                </h2>
                <p className="text-xs text-white/60 mt-1">
                  Sent Pumps: {visibleSentMovements.length} · Collected Pumps: {visibleCollectedMovements.length}
                </p>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-cyan-300">Sent Pumps</h3>
                {visibleSentMovements.length === 0 && (
                  <p className="text-xs text-white/60">No sent pump records for this employee.</p>
                )}
                {visibleSentMovements.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-white/60 border-b border-white/10">
                          <th className="py-2 pr-2">Pump</th>
                          <th className="py-2 pr-2">Driver</th>
                          <th className="py-2 pr-2">Sent At (US)</th>
                          <th className="py-2 pr-2">Delivered At (US)</th>
                          <th className="py-2 pr-2">Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSentMovements.map((row, idx) => (
                          <tr key={`${row.orderId}-${row.pumpNumber}-${idx}`} className="border-b border-white/5">
                            <td className="py-2 pr-2">#{row.pumpNumber}</td>
                            <td className="py-2 pr-2">{row.driverName}</td>
                            <td className="py-2 pr-2">{formatUsDateTime(row.sentAt)}</td>
                            <td className="py-2 pr-2">{formatUsDateTime(row.deliveredAt)}</td>
                            <td className="py-2 pr-2">{row.orderId.slice(0, 8)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">Collected Pumps</h3>
                {visibleCollectedMovements.length === 0 && (
                  <p className="text-xs text-white/60">No collected pump records for this employee.</p>
                )}
                {visibleCollectedMovements.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-white/60 border-b border-white/10">
                          <th className="py-2 pr-2">Pump</th>
                          <th className="py-2 pr-2">Driver</th>
                          <th className="py-2 pr-2">Collected At (US)</th>
                          <th className="py-2 pr-2">Returned At (US)</th>
                          <th className="py-2 pr-2">Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCollectedMovements.map((row, idx) => (
                          <tr key={`${row.orderId}-${row.pumpNumber}-${idx}`} className="border-b border-white/5">
                            <td className="py-2 pr-2">#{row.pumpNumber}</td>
                            <td className="py-2 pr-2">{row.driverName}</td>
                            <td className="py-2 pr-2">{formatUsDateTime(row.collectedAt)}</td>
                            <td className="py-2 pr-2">{formatUsDateTime(row.deliveredAt)}</td>
                            <td className="py-2 pr-2">{row.orderId.slice(0, 8)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </PharmacyAdminFrame>
  );
}
