/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new functions
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  UserCheck,
  Truck,
  ArrowLeft,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <main className="bg-[#020617] min-h-screen flex flex-col justify-center items-center p-4 text-white overflow-hidden">
      {/* TITLE */}
      <h1 className="text-3xl font-black uppercase italic tracking-tight mb-2">
        Register
      </h1>
      <p className="text-slate-400 text-sm mb-10">
        Select registration type
      </p>

      {/* OPTIONS */}
      <div className="w-full max-w-xs space-y-4">
        {/* PHARMACY */}
        <button
          onClick={() => router.push("/pharmacies/register")}
          className="w-full bg-white text-slate-950 py-4 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center justify-between px-8 shadow-xl active:scale-95 transition-all"
        >
          <span className="flex items-center gap-3">
            <Building2 size={18} />
            Register Pharmacy
          </span>
        </button>

        {/* EMPLOYEE */}
        <button
          onClick={() => router.push("/auth/register/employee")}
          className="w-full bg-white text-slate-950 py-4 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center justify-between px-8 shadow-xl active:scale-95 transition-all"
        >
          <span className="flex items-center gap-3">
            <UserCheck size={18} />
            Register Employee
          </span>
        </button>

        {/* DRIVER */}
        <button
          onClick={() => router.push("/auth/register/driver")}
          className="w-full bg-white text-slate-950 py-4 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center justify-between px-8 shadow-xl active:scale-95 transition-all"
        >
          <span className="flex items-center gap-3">
            <Truck size={18} />
            Register Driver
          </span>
        </button>
      </div>

      {/* BACK */}
      <button
        onClick={() => router.push("/")}
        className="mt-10 flex items-center gap-2 text-slate-600 text-[10px] uppercase font-bold underline"
      >
        <ArrowLeft size={12} />
        Back
      </button>
    </main>
  );
}
