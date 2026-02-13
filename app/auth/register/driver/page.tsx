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
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import SignaturePad from "@/components/SignaturePad";
import { sendAppEmail } from "@/lib/emailClient";

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
  const [plate, setPlate] = useState("");

  const [vehiclePhotoBase64, setVehiclePhotoBase64] = useState<string | null>(null);
  const [driverPin, setDriverPin] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonymousAuth();
  }, []);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setVehiclePhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleRegister() {
    setError(null);
    setLoading(true);

    try {
      await ensureAnonymousAuth();

      const pin = Math.floor(1000 + Math.random() * 9000).toString();

      const ref = await addDoc(collection(db, "drivers"), {
        fullName: fullName.toUpperCase(),
        email,
        country,
        state,
        city,
        plate: plate.toUpperCase(),
        vehiclePhotoBase64,
        pin,
        active: true,
        createdAt: serverTimestamp(),
      });

      const sentAt = new Date().toLocaleString("en-US");
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
            {new Date().toLocaleString("en-US")}
          </p>

          <p>Your login PIN is:</p>
          <div className="text-3xl font-bold text-indigo-400 mb-4">
            {driverPin}
          </div>

          <SignaturePad
            onSave={(signatureBase64) => {
              addDoc(collection(db, "signatures"), {
                driverId,
                signatureBase64,
                createdAt: serverTimestamp(),
              });
            }}
          />

          <button
            onClick={() => router.push("/auth/login")}
            className="w-full mt-6 py-2 rounded bg-green-600 hover:bg-green-700"
          >
            Finish & Go to Login
          </button>
        </div>
      </main>
    );
  }

  // 📝 REGISTRATION FORM
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full space-y-3">

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

        <input
          placeholder="Vehicle Plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="w-full text-sm"
        />

        {/* ✅ VEHICLE IMAGE PREVIEW */}
        {vehiclePhotoBase64 && (
          <div>
            <p className="text-xs text-white/60 mb-1">Vehicle Photo Preview</p>
            <img
              src={vehiclePhotoBase64}
              alt="Vehicle"
              className="w-full h-40 object-contain rounded border border-white/10 bg-black"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full py-2 rounded bg-white text-black font-semibold"
        >
          {loading ? "REGISTERING..." : "REGISTER DRIVER"}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full text-xs text-white/50"
        >
          ← BACK
        </button>
      </div>
    </main>
  );
}
