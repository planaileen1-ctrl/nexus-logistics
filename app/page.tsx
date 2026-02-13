/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new fields
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */
"use client";

import { useRouter } from "next/navigation";
import { Truck, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] flex flex-col items-center justify-center text-white px-6 overflow-hidden font-sans selection:bg-emerald-400 selection:text-slate-900">
      
      {/* Background glow effects */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full -z-10 animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full -z-10 animate-pulse" style={{ animationDuration: "6s" }} />

      {/* HERO CARD */}
      <section className="w-full max-w-md">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl px-8 pt-16 pb-12 shadow-2xl border border-emerald-500/30 hover:border-emerald-500/60 relative overflow-hidden animate-in fade-in duration-700">
          
          {/* Premium glow border */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

          {/* Decorative glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/15 blur-3xl rounded-full opacity-70" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/10 blur-2xl rounded-full opacity-50" />

          {/* LOGO */}
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="mb-8 relative">
              <div className="absolute inset-0 blur-2xl bg-emerald-500/40 rounded-full animate-pulse" style={{ animationDuration: "3s" }} />
              <div className="absolute inset-0 blur-xl bg-emerald-400/20 rounded-full" />
              <Truck
                size={80}
                className="relative text-emerald-400 drop-shadow-[0_0_40px_rgba(52,211,153,0.7)]"
              />
            </div>

            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-tight bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
              Nexus <span className="text-emerald-400">Logistics</span>
            </h1>

            <p className="mt-4 text-slate-300 text-sm max-w-xs font-medium">
              Secure Delivery & Returns Management Platform
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="mt-12 space-y-3 relative z-10">
            <button
              onClick={() => router.push("/auth/login")}
              className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg hover:shadow-emerald-500/50 transition-all duration-300
              hover:from-emerald-400 hover:to-emerald-500 hover:scale-[1.02]
              active:scale-95"
            >
              <span>Login</span>
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>

            <button
              onClick={() => router.push("/auth/register")}
              className="group w-full bg-white/10 hover:bg-white/15 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 border border-white/20 hover:border-emerald-400/40 transition-all duration-300"
            >
              <span>Register</span>
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </div>
      </section>

      {/* ADMIN ACCESS */}
      <button
        onClick={() => router.push("/admin/login")}
        className="mt-16 text-xs uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors duration-300 font-semibold"
      >
        → Administrator Access
      </button>

    </main>
  );
}
