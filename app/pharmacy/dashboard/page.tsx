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
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
      <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-8 space-y-6">

        <h1 className="text-2xl font-bold text-center">
          Pharmacy Dashboard
        </h1>

        <p className="text-center text-sm text-white/60">
          Manage your pharmacy operations
        </p>

        {/* CLIENTS */}
        <button
          onClick={() => router.push("/pharmacy/clients")}
          className="w-full py-3 rounded bg-white text-black font-semibold"
        >
          Manage Clients
        </button>

        {/* PUMPS */}
        <button
          onClick={() => router.push("/pharmacy/pumps")}
          className="w-full py-3 rounded bg-white text-black font-semibold"
        >
          Manage Pumps
        </button>

        {/* DRIVERS */}
        <button
          onClick={() => router.push("/pharmacy/drivers")}
          className="w-full py-3 rounded bg-white text-black font-semibold"
        >
          View Drivers
        </button>

        {/* ORDERS (NEXT PHASE) */}
        <button
          disabled
          className="w-full py-3 rounded bg-white/10 text-white/40 cursor-not-allowed"
        >
          Orders (Coming Soon)
        </button>

        <button
          onClick={() => router.back()}
          className="w-full text-xs text-white/50"
        >
          ← BACK
        </button>

      </div>
    </main>
  );
}
