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

import { useRouter } from "next/navigation";

export default function EmployeeDashboardPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white px-4">
      <div className="w-full max-w-4xl space-y-8">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Employee Dashboard
          </h1>
          <p className="text-sm text-white/60">
            Select an action to continue
          </p>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* MEDICAL PUMPS */}
          <div
            onClick={() => router.push("/employee/pumps")}
            className="cursor-pointer bg-black/40 border border-indigo-500/30 hover:border-indigo-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-indigo-400 text-2xl">🏥</div>
              <h2 className="text-xl font-semibold">
                Medical Pumps
              </h2>
              <p className="text-sm text-white/60">
                Register and manage hospital medical pumps.
                Pumps are linked to delivery orders.
              </p>
              <p className="text-xs text-indigo-400">
                Go to pump management →
              </p>
            </div>
          </div>

          {/* CUSTOMERS */}
          <div
            onClick={() => router.push("/employee/customers")}
            className="cursor-pointer bg-black/40 border border-green-500/30 hover:border-green-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-green-400 text-2xl">👤</div>
              <h2 className="text-xl font-semibold">
                Customers
              </h2>
              <p className="text-sm text-white/60">
                Create and manage patients or pharmacy customers.
                Includes full address and contact data.
              </p>
              <p className="text-xs text-green-400">
                Go to customer management →
              </p>
            </div>
          </div>

          {/* ORDERS */}
          <div
            onClick={() => router.push("/employee/orders")}
            className="cursor-pointer bg-black/40 border border-yellow-500/30 hover:border-yellow-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-yellow-400 text-2xl">📦</div>
              <h2 className="text-xl font-semibold">
                Orders
              </h2>
              <p className="text-sm text-white/60">
                Create delivery orders from pumps and assign them
                to customers for drivers.
              </p>
              <p className="text-xs text-yellow-400">
                Go to order management →
              </p>
            </div>
          </div>

        </div>

        {/* FOOTER NOTE */}
        <div className="text-center text-xs text-white/40">
          Orders created here will be visible to drivers by city and pharmacy.
        </div>

        {/* BACK */}
        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-xs text-white/50 hover:text-white"
          >
            ← Back to menu
          </button>
        </div>

      </div>
    </main>
  );
}
