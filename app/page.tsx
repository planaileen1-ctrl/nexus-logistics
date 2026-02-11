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
    <main className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white px-6 overflow-hidden font-sans selection:bg-emerald-500">

      {/* HERO CARD */}
      <section className="w-full max-w-md">
        <div className="bg-slate-950 rounded-[2.75rem] px-8 pt-14 pb-12 shadow-2xl border-b-[8px] border-emerald-500 relative overflow-hidden animate-in fade-in duration-500">

          {/* Glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 blur-3xl rounded-full" />

          {/* LOGO */}
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="mb-8 relative">
              <div className="absolute inset-0 blur-2xl bg-emerald-500/30 rounded-full" />
              <Truck
                size={76}
                className="relative text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.6)]"
              />
            </div>

            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">
              Nexus <span className="text-emerald-500">Logistics</span>
            </h1>

            <p className="mt-5 text-slate-400 text-sm max-w-xs">
              Secure logistics and delivery control platform
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="mt-14 space-y-4 relative z-10">
            <button
              onClick={() => router.push("/auth/login")}
              className="group w-full bg-white text-slate-950 py-5 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-between px-10 shadow-2xl transition-all
              hover:scale-[1.015] hover:shadow-[0_25px_50px_rgba(0,0,0,0.45)]
              active:scale-95"
            >
              Login
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

            <button
              onClick={() => router.push("/auth/register")}
              className="group w-full bg-white/90 text-slate-950 py-5 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-between px-10 shadow-xl transition-all
              hover:bg-white hover:scale-[1.015]
              active:scale-95"
            >
              Register
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </section>

      {/* ADMIN ACCESS */}
      <button
        onClick={() => router.push("/admin/login")}
        className="mt-14 text-[9px] uppercase tracking-widest text-slate-600 underline hover:text-slate-300 transition"
      >
        Administrator Access
      </button>

    </main>
  );
}
