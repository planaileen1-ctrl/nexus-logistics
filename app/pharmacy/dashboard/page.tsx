/**
 * ⚠️ PROTECTED FILE — PHARMACY DASHBOARD
 *
 * Main control panel for pharmacies.
 * This file ONLY defines navigation.
 *
 * ❌ Do NOT add business logic here
 * ❌ Do NOT touch Firestore here
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useRouter } from "next/navigation";

export default function PharmacyDashboardPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] text-white flex items-center justify-center p-4">
      
      {/* Background decorations */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-blue-500/8 blur-3xl rounded-full -z-10" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full -z-10" />
      
      <div className="w-full max-w-lg space-y-6">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Pharmacy Central
          </h1>
          <p className="text-sm text-slate-400">Manage operations & inventory</p>
        </div>

        {/* CARDS GRID */}
        <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/40 rounded-2xl p-6 border border-slate-700/50 space-y-3">

          {/* CLIENTS */}
          <button
            onClick={() => router.push("/pharmacy/clients")}
            className="group w-full py-4 px-5 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="font-semibold text-white group-hover:text-blue-100 transition">Manage Clients</p>
              <p className="text-xs text-blue-300/70">View & edit client records</p>
            </div>
            <span className="text-blue-400 text-xl">→</span>
          </button>

          {/* PUMPS */}
          <button
            onClick={() => router.push("/pharmacy/pumps")}
            className="group w-full py-4 px-5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="font-semibold text-white group-hover:text-emerald-100 transition">Manage Pumps</p>
              <p className="text-xs text-emerald-300/70">Track & maintain inventory</p>
            </div>
            <span className="text-emerald-400 text-xl">→</span>
          </button>

          {/* DRIVERS */}
          <button
            onClick={() => router.push("/pharmacy/drivers")}
            className="group w-full py-4 px-5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="font-semibold text-white group-hover:text-cyan-100 transition">View Drivers</p>
              <p className="text-xs text-cyan-300/70">Monitor available drivers</p>
            </div>
            <span className="text-cyan-400 text-xl">→</span>
          </button>

          {/* ORDERS - Coming Soon */}
          <button
            disabled
            className="w-full py-4 px-5 rounded-xl bg-slate-700/20 border border-slate-600/30 cursor-not-allowed flex items-center justify-between opacity-60"
          >
            <div className="text-left">
              <p className="font-semibold text-slate-400">Orders</p>
              <p className="text-xs text-slate-500">Coming Soon</p>
            </div>
            <span className="text-slate-500 text-xl">→</span>
          </button>

        </div>

        {/* BACK BUTTON */}
        <button
          onClick={() => router.back()}
          className="w-full py-3 rounded-xl border border-slate-600/50 hover:border-slate-400/50 text-slate-400 hover:text-slate-200 font-semibold transition-all duration-300 text-sm uppercase tracking-wide"
        >
          ← Back
        </button>

      </div>
    </main>
  );
}
