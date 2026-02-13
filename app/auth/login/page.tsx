/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new functions / context storage
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  /* =====================
     HANDLE KEYPAD
  ===================== */

  const handlePress = (value: string) => {
    if (value === "C") {
      setPin("");
      setError("");
      return;
    }

    if (value === "OK") {
      if (pin.length === 4) {
        validatePin();
      }
      return;
    }

    if (pin.length < 4) {
      const next = pin + value;
      setPin(next);
      if (next.length === 4) {
        validatePin(next);
      }
    }
  };

  /* =====================
     VALIDATE PIN
  ===================== */

  const validatePin = async (overridePin?: string) => {
    const activePin = overridePin || pin;
    try {
      // 1️⃣ SUPER ADMIN
      if (activePin === "1844") {
        localStorage.setItem("NEXUS_ADMIN", "true");
        router.replace("/admin");
        return;
      }

      // 2️⃣ PHARMACY
      const pharmacyQuery = query(
        collection(db, "pharmacies"),
        where("pin", "==", activePin),
        where("active", "==", true)
      );

      const pharmacySnap = await getDocs(pharmacyQuery);

      if (!pharmacySnap.empty) {
        const pharmacyDoc = pharmacySnap.docs[0];
        const pharmacy = pharmacyDoc.data();

        // 🔐 BLIND PHARMACY CONTEXT
        localStorage.setItem("PHARMACY_ID", pharmacyDoc.id);
        localStorage.setItem("PHARMACY_NAME", pharmacy.pharmacyName);
        localStorage.setItem("PHARMACY_CITY", pharmacy.city || "");
        localStorage.setItem("PHARMACY_STATE", pharmacy.state || "");
        localStorage.setItem("PHARMACY_COUNTRY", pharmacy.country || "");

        router.replace("/pharmacy/dashboard");
        return;
      }

      // 3️⃣ EMPLOYEE  ✅ BLINDED HERE
      const employeeQuery = query(
        collection(db, "employees"),
        where("pin", "==", activePin),
        where("active", "==", true)
      );

      const employeeSnap = await getDocs(employeeQuery);

      if (!employeeSnap.empty) {
        const employeeDoc = employeeSnap.docs[0];
        const employee = employeeDoc.data();

        // 🛡️ HARD CONTEXT (THIS FIXES PUMPS / CUSTOMERS / ORDERS)
        localStorage.setItem("EMPLOYEE_ID", employeeDoc.id);
        localStorage.setItem("EMPLOYEE_NAME", employee.fullName);
        localStorage.setItem("EMPLOYEE_EMAIL", employee.email || "");
        localStorage.setItem("EMPLOYEE_ROLE", employee.role);

        localStorage.setItem("PHARMACY_ID", employee.pharmacyId);
        localStorage.setItem("PHARMACY_NAME", employee.pharmacyName);
        localStorage.setItem("PHARMACY_CITY", employee.city || "");
        localStorage.setItem("PHARMACY_STATE", employee.state || "");
        localStorage.setItem("PHARMACY_COUNTRY", employee.country || "");
        localStorage.setItem("EMPLOYEE_LOGIN_AT", new Date().toISOString());

        router.replace("/employee/dashboard");
        return;
      }

      // 4️⃣ DRIVER
      const driverQuery = query(
        collection(db, "drivers"),
        where("pin", "==", activePin),
        where("active", "==", true)
      );

      const driverSnap = await getDocs(driverQuery);

      if (!driverSnap.empty) {
        const driverDoc = driverSnap.docs[0];
        const driver = driverDoc.data();

        localStorage.setItem("DRIVER_ID", driverDoc.id);
        localStorage.setItem("DRIVER_NAME", driver.fullName);

        router.replace("/driver/dashboard");
        return;
      }

      // ❌ INVALID PIN
      setError("INVALID PIN");
      setPin("");
    } catch (err) {
      console.error(err);
      setError("LOGIN ERROR");
      setPin("");
    }
  };

  /* =====================
     UI
  ===================== */

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#020617] via-[#0a091e] to-[#020617] text-white overflow-hidden">
      
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full -z-10 animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full -z-10" />
      
      <div className="flex flex-col items-center gap-8">

        {/* TITLE */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
            Sign In
          </h1>
          <p className="text-sm text-slate-400">Enter your 4-digit PIN</p>
        </div>

        {/* PIN DOTS */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                pin.length > i
                  ? "bg-emerald-400 border-emerald-400 shadow-lg shadow-emerald-400/50 scale-110"
                  : "border-slate-600 hover:border-slate-400"
              }`}
            />
          ))}
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-lg px-4 py-2 text-sm text-red-300 animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {/* KEYPAD */}
        <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-7 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          {["1","2","3","4","5","6","7","8","9","C","0","OK"].map((key) => (
            <button
              key={key}
              onClick={() => handlePress(key)}
              disabled={key === "OK" && pin.length !== 4}
              className={`w-16 h-14 rounded-xl font-bold text-lg transition-all duration-200 ${
                key === "C"
                  ? "bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30"
                  : key === "OK"
                  ? pin.length === 4
                    ? "bg-emerald-500/80 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/30"
                    : "bg-slate-700/30 text-slate-500 border border-slate-600/30 cursor-not-allowed"
                  : "bg-slate-700/40 hover:bg-slate-600/60 text-white border border-slate-600/50 hover:shadow-lg hover:shadow-slate-500/20 hover:scale-105 active:scale-95"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.replace("/")}
          className="text-xs uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors duration-300 font-semibold mt-4"
        >
          ← BACK TO HOME
        </button>
      </div>
    </div>
  );
}
