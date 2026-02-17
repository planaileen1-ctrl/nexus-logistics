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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
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

export default function RegisterPharmacyPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    licenseCode: "",
    pharmacyName: "",
    email: "",
    country: "" as CountryKey | "",
    state: "",
    city: "",
    address: "", // ✅ PHYSICAL ADDRESS
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [generatedSecurityPin, setGeneratedSecurityPin] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    ensureAnonymousAuth();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value.toUpperCase(),
    }));
  }

  async function handleRegister() {
    setError("");
    setLoading(true);

    try {
      await ensureAnonymousAuth();

      if (!form.licenseCode) {
        throw new Error("LICENSE CODE IS REQUIRED");
      }

      if (!form.address) {
        throw new Error("PHYSICAL ADDRESS IS REQUIRED");
      }

      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const securityPin6 = Math.floor(100000 + Math.random() * 900000).toString();

      await addDoc(collection(db, "pharmacies"), {
        licenseCode: form.licenseCode,
        pharmacyName: form.pharmacyName,
        email: form.email,
        country: form.country,
        state: form.state,
        city: form.city,
        address: form.address, // ✅ SAVED
        pin,
        securityPin6,
        active: true,
        createdAt: serverTimestamp(),
      });

      const sentAt = new Date().toLocaleString("en-US", DATE_TIME_FORMAT);
      await sendAppEmail({
        to: form.email,
        subject: "Your Pharmacy Access PIN",
        html: `
          <p>Hello ${form.pharmacyName || ""},</p>
          <p>Your pharmacy registration is complete.</p>
          <p><strong>Employee Registration PIN (4 digits):</strong> ${pin}</p>
          <p><strong>Pharmacy Security PIN (6 digits):</strong> ${securityPin6}</p>
          <p><strong>Registered:</strong> ${sentAt}</p>
          <p>Please keep this PIN secure.</p>
        `,
        text: `Employee Registration PIN (4 digits): ${pin}. Pharmacy Security PIN (6 digits): ${securityPin6}. Registered: ${sentAt}.`,
      });

      setGeneratedPin(pin);
      setGeneratedSecurityPin(securityPin6);
      setRegistered(true);
    } catch (err) {
      console.error(err);
      setError("REGISTRATION FAILED");
    } finally {
      setLoading(false);
    }
  }

  // ✅ CONFIRMATION SCREEN
  if (registered && generatedPin && generatedSecurityPin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-8 text-center space-y-5">
          <h1 className="text-2xl font-bold">PHARMACY REGISTERED</h1>

          <p className="text-white/70">SAVE BOTH PINS SECURELY.</p>

          <div className="text-left space-y-2">
            <p className="text-xs text-emerald-300 font-bold tracking-wider">
              4-DIGIT PIN (FOR EMPLOYEE REGISTRATION)
            </p>
            <div className="text-4xl font-bold tracking-widest bg-black border border-white/20 rounded py-4 text-center">
              {generatedPin}
            </div>
          </div>

          <div className="text-left space-y-2">
            <p className="text-xs text-amber-300 font-bold tracking-wider">
              6-DIGIT SECURITY PIN (FOR PHARMACY LOGIN)
            </p>
            <div className="text-4xl font-bold tracking-widest bg-black border border-amber-400/40 rounded py-4 text-center">
              {generatedSecurityPin}
            </div>
          </div>

          <button
            onClick={() => router.push("/auth/login")}
            className="w-full bg-white text-black py-2 rounded font-semibold"
          >
            CONTINUE TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  // ✅ FORM
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-8 space-y-5">
        <div className="flex justify-start">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            ← BACK
          </button>
        </div>
        <h1 className="text-2xl font-bold text-center">REGISTER PHARMACY</h1>

        <div>
          <label className="text-xs">LICENSE CODE</label>
          <input
            name="licenseCode"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          />
        </div>

        <div>
          <label className="text-xs">PHARMACY NAME</label>
          <input
            name="pharmacyName"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          />
        </div>

        <div>
          <label className="text-xs">EMAIL</label>
          <input
            name="email"
            type="email"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          />
        </div>

        <div>
          <label className="text-xs">COUNTRY</label>
          <select
            name="country"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          >
            <option value="">SELECT COUNTRY</option>
            {Object.keys(COUNTRIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {form.country && (
          <div>
            <label className="text-xs">STATE / PROVINCE</label>
            <select
              name="state"
              onChange={handleChange}
              className="w-full mt-1 p-2 rounded bg-black border border-white/10"
            >
              <option value="">SELECT</option>
              {COUNTRIES[form.country].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs">CITY</label>
          <input
            name="city"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          />
        </div>

        {/* ✅ PHYSICAL ADDRESS */}
        <div>
          <label className="text-xs">PHYSICAL ADDRESS</label>
          <input
            name="address"
            placeholder="Street, number, reference"
            onChange={handleChange}
            className="w-full mt-1 p-2 rounded bg-black border border-white/10"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-white text-black py-2 rounded font-semibold"
        >
          {loading ? "REGISTERING..." : "REGISTER PHARMACY"}
        </button>

      
      </div>
    </div>
  );
}
