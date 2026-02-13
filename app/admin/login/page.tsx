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

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  /* =====================
     VALIDATE ADMIN PIN
  ===================== */
  const validatePin = (overridePin?: string) => {
    const activePin = overridePin || pin;
    if (activePin === "1844") {
      localStorage.setItem("NEXUS_ADMIN", "true");
      router.replace("/admin");
    } else {
      setError("INVALID ADMIN PIN");
      setPin("");
    }
  };

  /* =====================
     HANDLE KEYPAD
  ===================== */
  const handleKey = (v: number | "C" | "OK") => {
    if (v === "C") {
      setPin("");
      setError("");
      return;
    }

    if (v === "OK") {
      if (pin.length === 4) {
        validatePin(); // ✅ ahora SÍ existe
      }
      return;
    }

    if (pin.length < 4) {
      const next = pin + String(v);
      setPin(next);
      if (next.length === 4) {
        validatePin(next);
      }
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 text-white bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] overflow-hidden">
      
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-red-500/8 blur-3xl rounded-full -z-10 animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full -z-10" />
      
      <div className="flex flex-col items-center gap-8">
        
        {/* ICON */}
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-red-500/30 rounded-full animate-pulse" style={{ animationDuration: "3s" }} />
          <ShieldCheck size={56} className="relative text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]" />
        </div>

        {/* TITLE */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent">
            ADMIN ACCESS
          </h1>
          <p className="text-sm text-slate-400">Restricted Area - Enter PIN</p>
        </div>

        {/* PIN BOXES */}
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all duration-300 ${
                pin.length > i
                  ? "border-red-500/60 bg-red-500/15 shadow-lg shadow-red-500/20"
                  : "border-slate-600/50"
              }`}
            >
              {pin.length > i ? "●" : ""}
            </div>
          ))}
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-sm text-red-300 animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {/* KEYPAD */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((v) => (
            <button
              key={v}
              onClick={() => handleKey(v as any)}
              disabled={v === "OK" && pin.length !== 4}
              className={`h-14 rounded-xl font-bold text-lg transition-all duration-200 ${
                v === "C"
                  ? "bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30"
                  : v === "OK"
                  ? pin.length === 4
                    ? "bg-red-500/70 hover:bg-red-500 text-white border border-red-400/50 shadow-lg shadow-red-500/30"
                    : "bg-slate-700/30 text-slate-500 border border-slate-600/30 cursor-not-allowed"
                  : "bg-slate-700/40 hover:bg-slate-600/60 text-white border border-slate-600/50 hover:shadow-lg hover:shadow-slate-500/20 hover:scale-105 active:scale-95"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="text-xs uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors duration-300 font-semibold mt-2"
        >
          ← BACK
        </button>
      </div>
    </main>
  );
}
