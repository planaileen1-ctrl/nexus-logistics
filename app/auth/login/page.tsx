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
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="flex flex-col items-center gap-6">

        {/* PIN DOTS */}
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border ${
                pin.length > i
                  ? "bg-green-400 border-green-400"
                  : "border-white/30"
              }`}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* KEYPAD */}
        <div className="grid grid-cols-3 gap-4 bg-black/40 p-6 rounded-xl">
          {["1","2","3","4","5","6","7","8","9","C","0","OK"].map((key) => (
            <button
              key={key}
              onClick={() => handlePress(key)}
              className="w-16 h-14 rounded-lg bg-black/60 hover:bg-black border border-white/10 text-lg font-semibold"
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.replace("/")}
          className="text-xs opacity-60 hover:opacity-100"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
