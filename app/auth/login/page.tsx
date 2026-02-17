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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [pendingPharmacy, setPendingPharmacy] = useState<{
    id: string;
    pharmacyName?: string;
    city?: string;
    state?: string;
    country?: string;
    securityPin6?: string;
  } | null>(null);
  const validatingRef = useRef(false);

  const requiredDigits = pendingPharmacy ? 6 : 4;

  function toMillis(ts: any): number {
    if (!ts) return 0;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    if (typeof ts === "string") return new Date(ts).getTime();
    return 0;
  }

  function resolveDriverDocForPin(docs: any[], pinValue: string) {
    if (!docs || docs.length === 0) return null;
    if (docs.length === 1) return docs[0];

    const cacheKey = `DRIVER_LAST_ID_FOR_PIN_${pinValue}`;
    const cachedId = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;

    if (cachedId) {
      const matched = docs.find((d) => d.id === cachedId);
      if (matched) return matched;
    }

    const sorted = [...docs].sort((a, b) => {
      const aMs = toMillis(a.data()?.createdAt);
      const bMs = toMillis(b.data()?.createdAt);
      return bMs - aMs;
    });

    return sorted[0];
  }

  useEffect(() => {
    void ensureAnonymousAuth();
  }, []);

  /* =====================
     HANDLE KEYPAD
  ===================== */

  const handlePress = (value: string) => {
    if (validatingRef.current) {
      return;
    }

    if (value === "C") {
      setPin("");
      setError("");
      setInfo("");
      return;
    }

    if (value === "OK") {
      if (pin.length === requiredDigits) {
        validatePin(pin);
      }
      return;
    }

    if (pin.length < requiredDigits) {
      const next = pin + value;
      setPin(next);
      if (next.length === requiredDigits) {
        validatePin(next);
      }
    }
  };

  const completePharmacyLogin = (pharmacyDocId: string, pharmacy: any) => {
    localStorage.setItem("PHARMACY_ID", pharmacyDocId);
    localStorage.setItem("PHARMACY_NAME", pharmacy.pharmacyName);
    localStorage.setItem("PHARMACY_CITY", pharmacy.city || "");
    localStorage.setItem("PHARMACY_STATE", pharmacy.state || "");
    localStorage.setItem("PHARMACY_COUNTRY", pharmacy.country || "");

    setPendingPharmacy(null);
    setPin("");
    setInfo("");
    router.replace("/pharmacy/dashboard");
  };

  /* =====================
     VALIDATE PIN
  ===================== */

  const validatePin = async (overridePin?: string) => {
    const activePin = overridePin || pin;

    if (activePin.length !== requiredDigits || validatingRef.current) {
      return;
    }

    validatingRef.current = true;
    setIsValidating(true);

    try {
      await ensureAnonymousAuth();

      // 0️⃣ PHARMACY SECURITY STEP (2FA-like with 6-digit PIN)
      if (pendingPharmacy) {
        if (activePin === String(pendingPharmacy.securityPin6 || "")) {
          completePharmacyLogin(pendingPharmacy.id, pendingPharmacy);
        } else {
          setError("INVALID SECURITY PIN");
          setPin("");
        }
        return;
      }

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

      const employeeQuery = query(
        collection(db, "employees"),
        where("pin", "==", activePin),
        where("active", "==", true)
      );

      const driverQuery = query(
        collection(db, "drivers"),
        where("pin", "==", activePin),
        where("active", "==", true)
      );

      const [pharmacySnap, employeeSnap, driverSnap] = await Promise.all([
        getDocs(pharmacyQuery),
        getDocs(employeeQuery),
        getDocs(driverQuery),
      ]);

      if (!pharmacySnap.empty) {
        const pharmacyDoc = pharmacySnap.docs[0];
        const pharmacy = pharmacyDoc.data();
        const securityPin6 = String(pharmacy.securityPin6 || "");

        if (securityPin6.length === 6) {
          setPendingPharmacy({
            id: pharmacyDoc.id,
            pharmacyName: pharmacy.pharmacyName,
            city: pharmacy.city || "",
            state: pharmacy.state || "",
            country: pharmacy.country || "",
            securityPin6,
          });
          setPin("");
          setError("");
          setInfo("Enter pharmacy 6-digit security PIN");
          return;
        }

        // 🔐 BLIND PHARMACY CONTEXT
        completePharmacyLogin(pharmacyDoc.id, pharmacy);
        return;
      }

      // 3️⃣ EMPLOYEE  ✅ BLINDED HERE
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
      if (!driverSnap.empty) {
        const driverDoc = resolveDriverDocForPin(driverSnap.docs, activePin) || driverSnap.docs[0];
        const driver = driverDoc.data();

        localStorage.setItem("DRIVER_ID", driverDoc.id);
        localStorage.setItem("DRIVER_NAME", driver.fullName);
        localStorage.setItem(`DRIVER_LAST_ID_FOR_PIN_${activePin}`, driverDoc.id);

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
    } finally {
      validatingRef.current = false;
      setIsValidating(false);
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
            {pendingPharmacy ? "Pharmacy Security" : "Sign In"}
          </h1>
          <p className="text-sm text-slate-400">
            {pendingPharmacy
              ? "Enter your 6-digit security PIN"
              : "Enter your 4-digit PIN"}
          </p>
          {pendingPharmacy?.pharmacyName && (
            <p className="text-xs text-emerald-300/90 font-semibold tracking-wide">
              {pendingPharmacy.pharmacyName}
            </p>
          )}
        </div>

        {/* PIN DOTS */}
        <div className="flex gap-4">
          {Array.from({ length: requiredDigits }).map((_, i) => (
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

        {info && !error && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-4 py-2 text-xs text-emerald-200 animate-in fade-in duration-300">
            {info}
          </div>
        )}

        {/* VALIDATING MESSAGE */}
        {isValidating && (
          <div className="text-xs uppercase tracking-widest text-emerald-300/90 animate-pulse">
            Verifying...
          </div>
        )}

        {/* KEYPAD */}
        <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-7 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          {["1","2","3","4","5","6","7","8","9","C","0","OK"].map((key) => (
            <button
              key={key}
              onClick={() => handlePress(key)}
              disabled={isValidating || (key === "OK" && pin.length !== requiredDigits)}
              className={`w-16 h-14 rounded-xl font-bold text-lg transition-all duration-200 ${
                key === "C"
                  ? "bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30"
                  : key === "OK"
                  ? pin.length === requiredDigits
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
