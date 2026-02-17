/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Employee Dashboard
 * Navigation only (no business logic here)
 *
 * UI upgraded to card-based layout
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, ensureAnonymousAuth } from "@/lib/firebase";
import {
  LayoutDashboard,
  Search,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [loginAt, setLoginAt] = useState("");
  const [pumpOutCount, setPumpOutCount] = useState(0);
  const [pumpOutOver20Count, setPumpOutOver20Count] = useState(0);
  const [pumpOutOver30Count, setPumpOutOver30Count] = useState(0);
  const [pumpReturnsPendingCount, setPumpReturnsPendingCount] = useState(0);
  const [maintenancePendingCount, setMaintenancePendingCount] = useState(0);

  useEffect(() => {
    const name = localStorage.getItem("EMPLOYEE_NAME") || "Unknown Employee";
    const email = localStorage.getItem("EMPLOYEE_EMAIL") || "";
    const savedLoginAt = localStorage.getItem("EMPLOYEE_LOGIN_AT");

    if (!savedLoginAt) {
      const now = new Date().toISOString();
      localStorage.setItem("EMPLOYEE_LOGIN_AT", now);
      setLoginAt(now);
    } else {
      setLoginAt(savedLoginAt);
    }

    setEmployeeName(name);
    setEmployeeEmail(email);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await ensureAnonymousAuth();

        const pharmacyId = localStorage.getItem("PHARMACY_ID");
        if (!pharmacyId) {
          setPumpOutCount(0);
          setPumpOutOver20Count(0);
          setPumpOutOver30Count(0);
          setPumpReturnsPendingCount(0);
          setMaintenancePendingCount(0);
          return;
        }

        const snap = await getDocs(
          query(collection(db, "orders"), where("pharmacyId", "==", pharmacyId))
        );

        const toMs = (ts: any) => {
          if (!ts) return 0;
          if (typeof ts === "string") return new Date(ts).getTime();
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts?.seconds === "number") return ts.seconds * 1000;
          return 0;
        };

        const orders = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => {
            const aTime = toMs(a.deliveredAt) || toMs(a.deliveredAtISO) || toMs(a.createdAt);
            const bTime = toMs(b.deliveredAt) || toMs(b.deliveredAtISO) || toMs(b.createdAt);
            return aTime - bTime;
          });

        const byCustomer = new Map<string, Map<string, number>>();

        orders.forEach((order: any) => {
          const customerId = String(order.customerId || "").trim();
          if (!customerId) return;

          if (!byCustomer.has(customerId)) {
            byCustomer.set(customerId, new Map<string, number>());
          }

          const pumpMap = byCustomer.get(customerId)!;
          const rawStatus = String(order.status || "").trim().toUpperCase();
          const isDelivered = rawStatus === "DELIVERED" || !!order.deliveredAt || !!order.deliveredAtISO;

          if (isDelivered) {
            const deliveredMs =
              toMs(order.deliveredAt) ||
              toMs(order.deliveredAtISO) ||
              toMs(order.statusUpdatedAt) ||
              toMs(order.createdAt);

            (order.pumpNumbers || []).forEach((num: any) => {
              const pumpNumber = String(num || "").trim();
              if (pumpNumber) {
                pumpMap.set(pumpNumber, deliveredMs);
              }
            });
          }

          (order.previousPumpsStatus || [])
            .filter((entry: any) => entry.returned)
            .forEach((entry: any) => {
              const pumpNumber = String(entry.pumpNumber || "").trim();
              if (pumpNumber) pumpMap.delete(pumpNumber);
            });

          if (order.previousPumpsReturned === true) {
            (order.previousPumps || []).forEach((num: any) => {
              const pumpNumber = String(num || "").trim();
              if (pumpNumber) pumpMap.delete(pumpNumber);
            });
          }

          (order.previousPumpsReturnToPharmacy || [])
            .filter((entry: any) => entry.returnedToPharmacy)
            .forEach((entry: any) => {
              const pumpNumber = String(entry.pumpNumber || "").trim();
              if (pumpNumber) pumpMap.delete(pumpNumber);
            });
        });

        const total = Array.from(byCustomer.values()).reduce(
          (count, pumpMap) => count + pumpMap.size,
          0
        );

        const now = Date.now();
        const dayMs = 1000 * 60 * 60 * 24;
        let over20 = 0;
        let over30 = 0;

        byCustomer.forEach((pumpMap) => {
          pumpMap.forEach((deliveredMs) => {
            const daysOut = deliveredMs > 0 ? Math.floor((now - deliveredMs) / dayMs) : 0;

            if (daysOut >= 20) over20 += 1;
            if (daysOut >= 30) over30 += 1;
          });
        });

        setPumpOutCount(total);
        setPumpOutOver20Count(over20);
        setPumpOutOver30Count(over30);

        const pendingReturnsCount = orders.reduce((count, order: any) => {
          const returnedByCustomer = (order.previousPumpsStatus || [])
            .filter((entry: any) => entry?.returned === true)
            .map((entry: any) => String(entry?.pumpNumber || "").trim())
            .filter(Boolean);

          if (returnedByCustomer.length === 0) return count;

          const returnedToPharmacySet = new Set(
            (order.previousPumpsReturnToPharmacy || [])
              .filter((entry: any) => entry?.returnedToPharmacy === true)
              .map((entry: any) => String(entry?.pumpNumber || "").trim())
              .filter(Boolean)
          );

          const pendingForOrder = returnedByCustomer.filter(
            (pumpNumber: string) => !returnedToPharmacySet.has(pumpNumber)
          ).length;

          return count + pendingForOrder;
        }, 0);

        setPumpReturnsPendingCount(pendingReturnsCount);

        const pumpsSnap = await getDocs(
          query(collection(db, "pumps"), where("pharmacyId", "==", pharmacyId))
        );

        const maintenanceCount = pumpsSnap.docs.reduce((count, d) => {
          const pump = d.data() as any;
          const isActive = pump.active !== false;
          const needsMaintenance = pump.maintenanceDue === true;
          return isActive && needsMaintenance ? count + 1 : count;
        }, 0);

        setMaintenancePendingCount(maintenanceCount);
      } catch (err) {
        console.error("Failed to load pump out count:", err);
        setPumpOutCount(0);
        setPumpOutOver20Count(0);
        setPumpOutOver30Count(0);
        setPumpReturnsPendingCount(0);
        setMaintenancePendingCount(0);
      }
    })();
  }, []);

  const pumpOutBadgeClass =
    pumpOutOver30Count > 0
      ? "bg-red-600 border-red-400/70 shadow-red-900/40"
      : pumpOutOver20Count > 0
      ? "bg-yellow-500 border-yellow-300/70 shadow-yellow-900/30 text-black"
      : "bg-blue-600 border-blue-400/70 shadow-blue-900/40";

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase sign out failed:", error);
    }

    localStorage.removeItem("EMPLOYEE_ID");
    localStorage.removeItem("EMPLOYEE_NAME");
    localStorage.removeItem("EMPLOYEE_EMAIL");
    localStorage.removeItem("EMPLOYEE_ROLE");
    localStorage.removeItem("EMPLOYEE_LOGIN_AT");
    localStorage.removeItem("PHARMACY_ID");
    localStorage.removeItem("PHARMACY_NAME");
    localStorage.removeItem("PHARMACY_CITY");
    localStorage.removeItem("PHARMACY_STATE");
    localStorage.removeItem("PHARMACY_COUNTRY");

    router.replace("/auth/login");
  };

  const formattedLoginAt = loginAt
    ? new Date(loginAt).toLocaleString("en-US", DATE_TIME_FORMAT)
    : "--";

  const stats = [
    { label: "Pump Out", value: String(pumpOutCount) },
    { label: "20+ Days", value: String(pumpOutOver20Count) },
    { label: "30+ Days", value: String(pumpOutOver30Count) },
  ];

  const actionCards = [
    {
      id: "pumps",
      title: "Medical Pumps",
      desc: "Manage pump inventory and availability",
      emoji: "🏥",
      link: "Go to pump management",
      onClick: () => router.push("/employee/pumps"),
      cardClass:
        "from-indigo-500/15 to-indigo-600/5 border-indigo-500/30 hover:border-indigo-400/70 hover:shadow-indigo-500/20",
      textClass: "text-indigo-400",
    },
    {
      id: "customers",
      title: "Customers",
      desc: "Customer database and administration",
      emoji: "👥",
      link: "Manage customers",
      onClick: () => router.push("/employee/customers"),
      cardClass:
        "from-emerald-500/15 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400/70 hover:shadow-emerald-500/20",
      textClass: "text-emerald-400",
    },
    {
      id: "shipping",
      title: "New Shipping Orders",
      desc: "Create a new rapid delivery order",
      emoji: "📦",
      link: "Create new order",
      onClick: () => router.push("/employee/orders?view=create"),
      cardClass:
        "from-amber-500/15 to-amber-600/5 border-amber-500/30 hover:border-amber-400/70 hover:shadow-amber-500/20",
      textClass: "text-amber-400",
      highlight: true,
    },
    {
      id: "pump-out",
      title: "Pump Out (Clients)",
      desc: "Pumps pending for collection from clients",
      emoji: "🧪",
      link: "Open pending client pumps",
      onClick: () => router.push("/employee/pumps-manager"),
      cardClass:
        "from-blue-500/15 to-blue-600/5 border-blue-500/30 hover:border-blue-400/70 hover:shadow-blue-500/20",
      textClass: "text-blue-400",
      badge: pumpOutCount,
      heartbeat: pumpOutCount > 0,
    },
    {
      id: "returns",
      title: "Pump Returns",
      desc: "Equipment return and intake logs",
      emoji: "↩️",
      link: "View return log",
      onClick: () => router.push("/employee/pump-returns"),
      cardClass:
        "from-rose-500/15 to-rose-600/5 border-rose-500/30 hover:border-rose-400/70 hover:shadow-rose-500/20",
      textClass: "text-rose-400",
      badge: pumpReturnsPendingCount,
      heartbeat: pumpReturnsPendingCount > 0,
    },
    {
      id: "maintenance",
      title: "Pump Maintenance",
      desc: "Technical service and prevention",
      emoji: "🧰",
      link: "Open maintenance",
      onClick: () => router.push("/employee/pump-maintenance"),
      cardClass:
        "from-lime-500/15 to-lime-600/5 border-lime-500/30 hover:border-lime-400/70 hover:shadow-lime-500/20",
      textClass: "text-lime-400",
      badge: maintenancePendingCount,
      heartbeat: maintenancePendingCount > 0,
    },
    {
      id: "activity",
      title: "Orders Activity",
      desc: "Complete movement and history logs",
      emoji: "🚚",
      link: "View orders activity",
      onClick: () => router.push("/employee/orders?view=activity"),
      cardClass:
        "from-cyan-500/15 to-cyan-600/5 border-cyan-500/30 hover:border-cyan-400/70 hover:shadow-cyan-500/20",
      textClass: "text-cyan-400",
    },
    {
      id: "backups",
      title: "Delivery PDF Backups",
      desc: "Download delivery proof documents",
      emoji: "📄",
      link: "Open archives",
      onClick: () => router.push("/employee/delivery-pdfs"),
      cardClass:
        "from-slate-500/15 to-slate-600/5 border-slate-500/30 hover:border-slate-400/70 hover:shadow-slate-500/20",
      textClass: "text-slate-300",
    },
    {
      id: "tracking",
      title: "Driver Tracking",
      desc: "Real-time driver location and status",
      emoji: "📍",
      link: "View live map",
      onClick: () => router.push("/employee/driver-tracking"),
      cardClass:
        "from-red-500/15 to-red-600/5 border-red-500/30 hover:border-red-400/70 hover:shadow-red-500/20",
      textClass: "text-red-400",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#070b16] text-slate-200 overflow-hidden">
      <div className="fixed top-0 left-0 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full -z-10" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full -z-10" />

      <aside className="hidden md:flex w-72 bg-[#0d1220]/90 border-r border-white/5 p-5 flex-col gap-6">
        <div className="flex items-center gap-3 px-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-black text-white leading-none">NEXUS</p>
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">LOGISTICS SYSTEMS</p>
          </div>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] font-bold text-slate-500 tracking-[0.22em] px-3">MAIN MENU</p>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-300">
            <LayoutDashboard size={18} />
            <span className="text-sm font-semibold">Dashboard</span>
          </button>
        </nav>

        <div className="mt-auto bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-300 tracking-widest">SESSION</p>
            <p className="text-sm font-semibold text-white">{employeeName}</p>
            {employeeEmail && <p className="text-[11px] text-slate-400 normal-case">{employeeEmail}</p>}
            <p className="text-[11px] text-slate-400">LOGIN: {formattedLoginAt}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 hover:bg-rose-500/25 text-xs font-bold flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            <span>SIGN OUT</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white">EMPLOYEE DASHBOARD</h1>
            <p className="text-sm text-slate-400 mt-1">Select an action to continue managing operations.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search functions..."
                className="w-64 rounded-xl bg-white/5 border border-white/10 py-2 pl-9 pr-3 text-sm text-slate-300 focus:outline-none focus:border-blue-400/50"
              />
            </div>
            <button className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[0.18em] text-slate-500">{stat.label}</p>
                <p className="text-3xl font-black text-white mt-1">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 grid place-items-center text-slate-400">•</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {actionCards.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`group relative text-left overflow-hidden bg-gradient-to-br border rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${action.cardClass} ${
                action.heartbeat ? "heartbeat-card" : ""
              }`}
            >
              {action.highlight && (
                <span className="absolute top-4 right-4 px-2 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wider">
                  PRIORITY
                </span>
              )}

              {typeof action.badge === "number" && action.badge > 0 && (
                <span className={`absolute top-4 right-4 min-w-6 h-6 px-1 rounded-full text-xs font-bold inline-flex items-center justify-center border shadow-lg ${pumpOutBadgeClass}`}>
                  {action.badge}
                </span>
              )}

              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                {action.emoji}
              </div>

              <h2 className="text-xl font-black text-white mb-1">{action.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{action.desc}</p>

              <div className="mt-5 flex items-center justify-between">
                <span className={`text-[10px] font-black tracking-[0.12em] ${action.textClass}`}>{action.link}</span>
                <div className="w-7 h-7 rounded-full bg-white/5 grid place-items-center group-hover:translate-x-1 transition-transform">
                  <ChevronRight size={14} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <footer className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-[11px] text-slate-300">
            Orders created here are visible to drivers by city and pharmacy.
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs font-bold tracking-[0.16em] text-slate-500 hover:text-white px-4 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            ← BACK
          </button>
        </footer>
      </main>
    </div>
  );
}
