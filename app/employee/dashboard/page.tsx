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
import { auth } from "@/lib/firebase";

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [loginAt, setLoginAt] = useState("");

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
    ? new Date(loginAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "--";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] text-white px-4 py-8 overflow-hidden">
      
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-emerald-500/8 blur-3xl rounded-full -z-10" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/8 blur-3xl rounded-full -z-10" />
      
      <div className="w-full max-w-5xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="text-center space-y-2 pt-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
            Employee Dashboard
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Select an action to continue managing operations
          </p>
        </div>

        <div className="bg-gradient-to-r from-slate-900/70 to-slate-800/40 border border-slate-700/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-emerald-300/90 font-semibold">
              Session
            </p>
            <p className="text-sm text-slate-100 font-semibold">
              {employeeName}
            </p>
            {employeeEmail && (
              <p className="text-xs text-slate-400">{employeeEmail}</p>
            )}
            <p className="text-xs text-slate-400">
              Login: <span className="text-slate-200">{formattedLoginAt}</span>
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 hover:border-rose-300/70 text-rose-200 text-xs md:text-sm font-semibold uppercase tracking-wide px-4 py-2 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* MEDICAL PUMPS */}
          <button
            onClick={() => router.push("/employee/pumps")}
            className="group cursor-pointer bg-gradient-to-br from-indigo-500/15 to-indigo-600/5 border border-indigo-500/40 hover:border-indigo-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-indigo-500/20"
          >
            <div className="space-y-4">
              <div className="text-indigo-300 text-4xl group-hover:scale-110 transition-transform">🏥</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-indigo-100 transition">Medical Pumps</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Register and manage hospital medical pumps linked to orders.</p>
              </div>
              <p className="text-xs text-indigo-400 font-semibold">Go to pump management →</p>
            </div>
          </button>

          {/* CUSTOMERS */}
          <button
            onClick={() => router.push("/employee/customers")}
            className="group cursor-pointer bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/40 hover:border-emerald-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-emerald-500/20"
          >
            <div className="space-y-4">
              <div className="text-emerald-300 text-4xl group-hover:scale-110 transition-transform">👥</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-emerald-100 transition">Customers</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Create and manage patient & pharmacy customers with full records.</p>
              </div>
              <p className="text-xs text-emerald-400 font-semibold">Go to customer management →</p>
            </div>
          </button>

          {/* ORDERS */}
          <button
            onClick={() => router.push("/employee/orders")}
            className="group cursor-pointer bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/40 hover:border-amber-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-amber-500/20"
          >
            <div className="space-y-4">
              <div className="text-amber-300 text-4xl group-hover:scale-110 transition-transform">📦</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-amber-100 transition">Orders</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Create delivery orders and assign them to drivers by location.</p>
              </div>
              <p className="text-xs text-amber-400 font-semibold">Go to order management →</p>
            </div>
          </button>

          {/* RETURN REMINDERS */}
          <button
            onClick={() => router.push("/employee/pumps-manager")}
            className="group cursor-pointer bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-blue-500/40 hover:border-blue-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-blue-500/20"
          >
            <div className="space-y-4">
              <div className="text-blue-300 text-4xl group-hover:scale-110 transition-transform">🧪</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-blue-100 transition">Return Reminders</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Review returned pumps and manage reminder notes by customer.</p>
              </div>
              <p className="text-xs text-blue-400 font-semibold">Open reminders →</p>
            </div>
          </button>

          {/* PUMP RETURNS */}
          <button
            onClick={() => router.push("/employee/pump-returns")}
            className="group cursor-pointer bg-gradient-to-br from-rose-500/15 to-rose-600/5 border border-rose-500/40 hover:border-rose-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-rose-500/20"
          >
            <div className="space-y-4">
              <div className="text-rose-300 text-4xl group-hover:scale-110 transition-transform">↩️</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-rose-100 transition">Pump Returns</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Confirm returns and track non-return reasons with records.</p>
              </div>
              <p className="text-xs text-rose-400 font-semibold">View return log →</p>
            </div>
          </button>

          {/* PUMP MAINTENANCE */}
          <button
            onClick={() => router.push("/employee/pump-maintenance")}
            className="group cursor-pointer bg-gradient-to-br from-lime-500/15 to-lime-600/5 border border-lime-500/40 hover:border-lime-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-lime-500/20"
          >
            <div className="space-y-4">
              <div className="text-lime-300 text-4xl group-hover:scale-110 transition-transform">🧰</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-lime-100 transition">Pump Maintenance</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Track cleaning, calibration, and inspection workflows.</p>
              </div>
              <p className="text-xs text-lime-400 font-semibold">Open maintenance →</p>
            </div>
          </button>

          {/* DRIVER ACTIVITY */}
          <button
            onClick={() => router.push("/employee/orders?view=activity")}
            className="group cursor-pointer bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-500/40 hover:border-cyan-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-cyan-500/20"
          >
            <div className="space-y-4">
              <div className="text-cyan-300 text-4xl group-hover:scale-110 transition-transform">🚚</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-cyan-100 transition">Driver Activity</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Live updates on driver deliveries and operations across fleet.</p>
              </div>
              <p className="text-xs text-cyan-400 font-semibold">View activity feed →</p>
            </div>
          </button>

          {/* ORDER SEARCH */}
          <button
            onClick={() => router.push("/employee/orders?view=orders")}
            className="group cursor-pointer bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-purple-500/40 hover:border-purple-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-purple-500/20"
          >
            <div className="space-y-4">
              <div className="text-purple-300 text-4xl group-hover:scale-110 transition-transform">🔍</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-purple-100 transition">Order Search</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Search orders by customer name or pump number quickly.</p>
              </div>
              <p className="text-xs text-purple-400 font-semibold">Open search view →</p>
            </div>
          </button>

          {/* DELIVERY PDF BACKUPS */}
          <button
            onClick={() => router.push("/employee/delivery-pdfs")}
            className="group cursor-pointer bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-500/40 hover:border-cyan-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-cyan-500/20"
          >
            <div className="space-y-4">
              <div className="text-cyan-300 text-4xl group-hover:scale-110 transition-transform">📄</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-cyan-100 transition">Delivery PDF Backups</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Open legal delivery PDFs and share them by email.</p>
              </div>
              <p className="text-xs text-cyan-400 font-semibold">Open PDF backups →</p>
            </div>
          </button>

          {/* DRIVER TRACKING */}
          <button
            onClick={() => router.push("/employee/driver-tracking")}
            className="group cursor-pointer bg-gradient-to-br from-red-500/15 to-red-600/5 border border-red-500/40 hover:border-red-400/80
                       rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-red-500/20"
          >
            <div className="space-y-4">
              <div className="text-red-300 text-4xl group-hover:scale-110 transition-transform">📍</div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold group-hover:text-red-100 transition">Driver Tracking</h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition">Monitor active drivers in real-time on an interactive map location system.</p>
              </div>
              <p className="text-xs text-red-400 font-semibold">View live map →</p>
            </div>
          </button>

        </div>

        {/* INFO NOTE */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-slate-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-300 font-medium">
            💡 Orders created here are visible to drivers by city and pharmacy. Track all logistics in real-time.
          </p>
        </div>

        {/* BACK */}
        <div className="text-center pt-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors font-semibold uppercase tracking-wide"
          >
            ← Back
          </button>
        </div>

      </div>
    </main>
  );
}
