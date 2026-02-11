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
  const validatePin = () => {
    if (pin === "1844") {
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
      setPin((p) => p + String(v));
    }
  };

  return (
    <main className="bg-[#020617] min-h-screen flex flex-col justify-center items-center p-4 text-white">
      <ShieldCheck size={48} className="text-emerald-500 mb-6" />
      <h1 className="text-xl font-black mb-8">ADMIN ACCESS</h1>

      {/* PIN BOXES */}
      <div className="flex gap-2 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black
              ${
                pin.length > i
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-white/10"
              }`}
          >
            {pin.length > i ? "•" : ""}
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && (
        <p className="text-red-500 text-xs font-bold mb-4 uppercase">
          {error}
        </p>
      )}

      {/* KEYPAD */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs bg-slate-900/80 p-5 rounded-2xl">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((v) => (
          <button
            key={v}
            onClick={() => handleKey(v as any)}
            className="h-14 rounded-full font-black text-lg bg-white/5 hover:bg-white/10 active:scale-90"
          >
            {v}
          </button>
        ))}
      </div>
    </main>
  );
}
