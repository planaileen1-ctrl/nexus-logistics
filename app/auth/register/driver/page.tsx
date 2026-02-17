/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new UI (preview)
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import SignaturePad from "@/components/SignaturePad";
import { sendAppEmail } from "@/lib/emailClient";

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

const COUNTRIES = {
  ECUADOR: [
    "AZUAY","BOLIVAR","CAÑAR","CARCHI","CHIMBORAZO","COTOPAXI","EL ORO",
    "ESMERALDAS","GALAPAGOS","GUAYAS","IMBABURA","LOJA","LOS RIOS","MANABI",
    "MORONA SANTIAGO","NAPO","ORELLANA","PASTAZA","PICHINCHA","SANTA ELENA",
    "SANTO DOMINGO","SUCUMBIOS","TUNGURAHUA","ZAMORA CHINCHIPE",
  ],
  "UNITED STATES": [
    "ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO",
    "CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS",
    "INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND",
    "MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA",
    "NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK",
    "NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON",
    "PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA",
    "TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON",
    "WEST VIRGINIA","WISCONSIN","WYOMING",
  ],
} as const;

type CountryKey = keyof typeof COUNTRIES;

export default function RegisterDriverPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryKey | "">("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [driverPin, setDriverPin] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonymousAuth();
  }, []);

  async function generateUniqueLoginPin(maxAttempts = 40): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = Math.floor(1000 + Math.random() * 9000).toString();

      const [pharmacySnap, employeeSnap, driverSnap] = await Promise.all([
        getDocs(query(collection(db, "pharmacies"), where("pin", "==", candidate))),
        getDocs(query(collection(db, "employees"), where("pin", "==", candidate))),
        getDocs(query(collection(db, "drivers"), where("pin", "==", candidate))),
      ]);

      if (pharmacySnap.empty && employeeSnap.empty && driverSnap.empty) {
        return candidate;
      }
    }

    throw new Error("Unable to generate a unique login PIN");
  }

  async function handleRegister() {
    setError(null);
    setLoading(true);

    try {
      await ensureAnonymousAuth();

      const pin = await generateUniqueLoginPin();

      const ref = await addDoc(collection(db, "drivers"), {
        fullName: fullName.toUpperCase(),
        email,
        country,
        state,
        city,
        pin,
        active: true,
        createdAt: serverTimestamp(),
      });

      const sentAt = new Date().toLocaleString("en-US", DATE_TIME_FORMAT);
      await sendAppEmail({
        to: email,
        subject: "Your Driver Login PIN",
        html: `
          <p>Hello ${fullName},</p>
          <p>Your driver account has been created.</p>
          <p><strong>Login PIN:</strong> ${pin}</p>
          <p><strong>Created:</strong> ${sentAt}</p>
          <p>Please keep this PIN secure.</p>
        `,
        text: `Your driver login PIN: ${pin}. Created: ${sentAt}.`,
      });

      setDriverId(ref.id);
      setDriverPin(pin);
    } catch (err) {
      console.error(err);
      setError("DRIVER REGISTRATION FAILED");
    } finally {
      setLoading(false);
    }
  }

  // ✅ CONFIRMATION + SIGNATURE
  if (driverPin && driverId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">

          <h1 className="text-2xl font-semibold mb-2">Driver Registered</h1>

          <p className="text-sm text-slate-400">Registration Date (USA)</p>
          <p className="text-indigo-400 mb-4">
            {new Date().toLocaleString("en-US", DATE_TIME_FORMAT)}
          </p>

          <p>Your login PIN is:</p>
          <div className="text-3xl font-bold text-indigo-400 mb-4">
            {driverPin}
          </div>

          <SignaturePad
            onSave={async (signatureBase64) => {
              setSavingSignature(true);
              setSignatureError(null);

              try {
                await ensureAnonymousAuth();

                await addDoc(collection(db, "signatures"), {
                  driverId,
                  signatureBase64,
                  createdAt: serverTimestamp(),
                });

                setSignatureSaved(true);
              } catch (err) {
                console.error(err);
                const message = err instanceof Error ? err.message : "Unknown error";
                setSignatureError(`Failed to save signature. ${message}`);
              } finally {
                setSavingSignature(false);
              }
            }}
          />

          {savingSignature && (
            <p className="text-xs text-slate-300 mt-3">Saving signature...</p>
          )}

          {signatureSaved && (
            <p className="text-xs text-green-400 mt-3">Signature saved successfully.</p>
          )}

          {signatureError && (
            <p className="text-xs text-red-400 mt-3">{signatureError}</p>
          )}

          <button
            disabled={!signatureSaved || savingSignature}
            onClick={() => router.push("/auth/login")}
            className="w-full mt-6 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            Finish & Go to Login
          </button>

          {!signatureSaved && !savingSignature && (
            <p className="text-xs text-slate-400 mt-3">
              Save signature first to continue.
            </p>
          )}
        </div>
      </main>
    );
  }

  // 📝 REGISTRATION FORM
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full space-y-3">

        <div className="flex justify-start">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            ← BACK
          </button>
        </div>

        <h1 className="text-xl font-semibold text-center">REGISTER DRIVER</h1>

        <input
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as CountryKey)}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
        >
          <option value="">SELECT COUNTRY</option>
          {Object.keys(COUNTRIES).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {country && (
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
          >
            <option value="">SELECT STATE</option>
            {COUNTRIES[country].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full py-2 rounded bg-white text-black font-semibold"
        >
          {loading ? "REGISTERING..." : "REGISTER DRIVER"}
        </button>

      
      </div>
    </main>
  );
}
