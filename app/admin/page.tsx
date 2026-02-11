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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createLicense,
  suspendLicense,
  cancelLicense,
  deleteLicense,
} from "@/lib/licenses";

type License = {
  id: string;
  code: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
};

export default function AdminPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔐 Protect admin route
  useEffect(() => {
    const isAdmin = localStorage.getItem("NEXUS_ADMIN");
    if (!isAdmin) {
      router.push("/");
    }
  }, [router]);

  async function handleCreateLicense() {
    if (!email) return;

    setLoading(true);

    const result = await createLicense(email);

    setLicenses((prev) => [
      {
        id: result.id,
        code: result.code,
        email,
        status: "ACTIVE",
      },
      ...prev,
    ]);

    setEmail("");
    setLoading(false);
  }

  async function handleSuspend(id: string) {
    await suspendLicense(id);
    setLicenses((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: "SUSPENDED" } : l
      )
    );
  }

  async function handleCancel(id: string) {
    await cancelLicense(id);
    setLicenses((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: "CANCELLED" } : l
      )
    );
  }

  async function handleDelete(id: string) {
    await deleteLicense(id);
    setLicenses((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="w-full max-w-2xl bg-[#020617] border border-slate-800 rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Super Admin – License Management
        </h1>

        {/* Create License */}
        <div className="mb-8">
          <label className="block text-sm mb-2">
            Pharmacy Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pharmacy@email.com"
            className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 mb-4"
          />

          <button
            onClick={handleCreateLicense}
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "CREATING..." : "CREATE LICENSE"}
          </button>
        </div>

        {/* Licenses */}
        <div>
          <h2 className="text-lg mb-4">Generated Licenses</h2>

          {licenses.length === 0 && (
            <p className="text-sm text-slate-400">
              No licenses created yet.
            </p>
          )}

          <ul className="space-y-4">
            {licenses.map((license) => (
              <li
                key={license.id}
                className="bg-slate-900 border border-slate-800 rounded p-4"
              >
                <p className="text-sm mb-1">
                  <strong>Code:</strong>{" "}
                  <span className="text-indigo-400">
                    {license.code}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mb-2">
                  {license.email}
                </p>
                <p className="text-xs mb-3">
                  Status:{" "}
                  <span className="font-semibold">
                    {license.status}
                  </span>
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSuspend(license.id)}
                    className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-700"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => handleCancel(license.id)}
                    className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(license.id)}
                    className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Back */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to Main Menu
          </button>
        </div>
      </div>
    </main>
  );
}
