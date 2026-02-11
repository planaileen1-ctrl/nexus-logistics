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

      await addDoc(collection(db, "pharmacies"), {
        licenseCode: form.licenseCode,
        pharmacyName: form.pharmacyName,
        email: form.email,
        country: form.country,
        state: form.state,
        city: form.city,
        address: form.address, // ✅ SAVED
        pin,
        active: true,
        createdAt: serverTimestamp(),
      });

      setGeneratedPin(pin);
      setRegistered(true);
    } catch (err) {
      console.error(err);
      setError("REGISTRATION FAILED");
    } finally {
      setLoading(false);
    }
  }

  // ✅ CONFIRMATION SCREEN
  if (registered && generatedPin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-8 text-center space-y-6">
          <h1 className="text-2xl font-bold">PHARMACY REGISTERED</h1>

          <p className="text-white/70">
            THIS IS YOUR ACCESS PIN. SAVE IT SECURELY.
          </p>

          <div className="text-4xl font-bold tracking-widest bg-black border border-white/20 rounded py-4">
            {generatedPin}
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

        <button
          onClick={() => router.back()}
          className="w-full text-xs text-white/50"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
