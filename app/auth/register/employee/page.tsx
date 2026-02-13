/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY WITHOUT APPROVAL
 *
 * Employee registration logic.
 * Stable and working.
 * Last verified: 2026-02-09
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  findPharmacyByPin,
  registerEmployee,
} from "@/lib/employees";
import { sendAppEmail } from "@/lib/emailClient";

import SignaturePad from "@/components/SignaturePad";
import { saveEmployeeSignature } from "@/lib/signatures";

export default function EmployeeRegisterPage() {
  const router = useRouter();

  // FORM FIELDS
  const [signatureSaved, setSignatureSaved] = useState(false);
const [savingSignature, setSavingSignature] = useState(false);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState(""); // ✅ CARGO
  const [email, setEmail] = useState("");
  const [pharmacyPin, setPharmacyPin] = useState("");

  const [pharmacy, setPharmacy] = useState<any>(null);

  // FLOW STATE
  const [employeePin, setEmployeePin] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [step, setStep] = useState<"FORM" | "SIGNATURE">("FORM");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔍 Verify pharmacy by PIN
  async function handleVerifyPharmacy() {
    setError(null);

    if (pharmacyPin.length !== 4) {
      setError("Pharmacy PIN must be 4 digits");
      return;
    }

    const result = await findPharmacyByPin(pharmacyPin);

    if (!result) {
      setError("Invalid or inactive pharmacy PIN");
      return;
    }

    setPharmacy(result);
  }

  // 👤 Register employee
  async function handleRegisterEmployee() {
    if (!pharmacy) return;

    if (!jobTitle) {
      setError("Job title is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await registerEmployee(
        fullName,
        email,
        pharmacy,
        jobTitle // ✅ PASAMOS EL CARGO
      );

      const sentAt = new Date().toLocaleString("en-US");
      await sendAppEmail({
        to: email,
        subject: "Your Employee Login PIN",
        html: `
          <p>Hello ${fullName},</p>
          <p>Your employee account has been created.</p>
          <p><strong>Login PIN:</strong> ${result.pin}</p>
          <p><strong>Pharmacy:</strong> ${pharmacy?.pharmacyName || ""}</p>
          <p><strong>Created:</strong> ${sentAt}</p>
          <p>Please keep this PIN secure.</p>
        `,
        text: `Your employee login PIN: ${result.pin}. Pharmacy: ${pharmacy?.pharmacyName || ""}. Created: ${sentAt}.`,
      });

      setEmployeeId(result.employeeId);
      setEmployeePin(result.pin);
      setStep("SIGNATURE");
    } catch (err) {
      console.error(err);
      setError("Failed to register employee");
    } finally {
      setLoading(false);
    }
  }

  // ✍️ SIGNATURE SCREEN
  if (step === "SIGNATURE" && employeeId && employeePin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">

          <h1 className="text-2xl font-semibold mb-2">
            Employee Registered
          </h1>

          <p className="text-sm text-slate-400 mb-1">
            Registration Date (USA)
          </p>

          <p className="text-indigo-400 mb-4">
            {new Date().toLocaleString("en-US")}
          </p>

          <p className="mb-2">Your login PIN is:</p>

          <div className="text-3xl font-bold text-indigo-400 mb-6">
            {employeePin}
          </div>

          <SignaturePad
            onSave={async (signatureBase64) => {
              await saveEmployeeSignature({
                employeeId,
                employeeName: fullName,
                pharmacyId: pharmacy.id,
                signatureBase64,
              });

              router.push("/auth/login");
            }}
          />

          <p className="text-xs text-slate-400 mt-3">
            Please sign using your finger or mouse
          </p>
        </div>
      </main>
    );
  }

  // 📝 REGISTRATION FORM
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full">

        <h1 className="text-xl font-semibold mb-6 text-center">
          Register Employee
        </h1>

        {/* FULL NAME */}
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full mb-3 px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        {/* JOB TITLE */}
        <input
          type="text"
          placeholder="Job Title (e.g. Pharmacist, Assistant)"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="w-full mb-3 px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        {/* PHARMACY PIN */}
        <input
          type="text"
          placeholder="Pharmacy PIN (4 digits)"
          value={pharmacyPin}
          onChange={(e) => setPharmacyPin(e.target.value)}
          maxLength={4}
          className="w-full mb-3 px-4 py-2 rounded bg-slate-800 border border-slate-700"
        />

        {!pharmacy && (
          <button
            onClick={handleVerifyPharmacy}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-700 mb-4"
          >
            Verify Pharmacy
          </button>
        )}

        {pharmacy && (
          <div className="mb-4 text-sm text-slate-300">
            <p><strong>Pharmacy:</strong> {pharmacy.pharmacyName}</p>
            <p>{pharmacy.city}, {pharmacy.state}, {pharmacy.country}</p>
          </div>
        )}

        {pharmacy && (
          <button
            onClick={handleRegisterEmployee}
            disabled={loading}
            className="w-full py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "REGISTERING..." : "REGISTER EMPLOYEE"}
          </button>
        )}

        {error && (
          <p className="text-red-400 text-sm mt-4">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
