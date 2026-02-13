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

          {/* PUMPS MANAGER */}
          <div
            onClick={() => router.push("/employee/pumps-manager")}
            className="cursor-pointer bg-black/40 border border-blue-500/30 hover:border-blue-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-blue-400 text-2xl">🧪</div>
              <h2 className="text-xl font-semibold">
                Pumps Manager
              </h2>
              <p className="text-sm text-white/60">
                See which customers have pumps and send
                return reminders for the next delivery.
              </p>
              <p className="text-xs text-blue-400">
                Open pumps manager →
              </p>
            </div>
          </div>

          {/* PUMP RETURNS */}
          <div
            onClick={() => router.push("/employee/pump-returns")}
            className="cursor-pointer bg-black/40 border border-rose-500/30 hover:border-rose-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-rose-400 text-2xl">↩️</div>
              <h2 className="text-xl font-semibold">
                Pump Returns
              </h2>
              <p className="text-sm text-white/60">
                Track returned pumps and reasons
                when pumps are not returned.
              </p>
              <p className="text-xs text-rose-400">
                View return log →
              </p>
            </div>
          </div>

          {/* DRIVER ACTIVITY */}
          <div
            onClick={() => router.push("/employee/orders?view=activity")}
            className="cursor-pointer bg-black/40 border border-cyan-500/30 hover:border-cyan-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-cyan-400 text-2xl">🚚</div>
              <h2 className="text-xl font-semibold">
                Driver Activity
              </h2>
              <p className="text-sm text-white/60">
                View live updates on what drivers are doing
                across all deliveries.
              </p>
              <p className="text-xs text-cyan-400">
                View activity feed →
              </p>
            </div>
          </div>

          {/* ORDER SEARCH */}
          <div
            onClick={() => router.push("/employee/orders?view=orders")}
            className="cursor-pointer bg-black/40 border border-purple-500/30 hover:border-purple-500
                       rounded-xl p-6 transition-all hover:scale-[1.02] hover:bg-black/60"
          >
            <div className="space-y-3">
              <div className="text-purple-400 text-2xl">🔍</div>
              <h2 className="text-xl font-semibold">
                Order Search
              </h2>
              <p className="text-sm text-white/60">
                Search created orders by customer name
                or pump number.
              </p>
              <p className="text-xs text-purple-400">
                Open search view →
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
