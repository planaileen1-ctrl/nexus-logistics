/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Employee Pumps (Medical)
 * Register and manage hospital medical pumps
 *
 * Fields:
 * - Pump Number (required)
 * - Brand (optional)
 * - Registered by (employee)
 * - Date & Time (USA)
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { normalizePumpScannerInput } from "@/lib/pumpScanner";

/* 🔹 Helper: format Firestore timestamp to USA date */
function formatDate(ts: any) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-US");
}

type Pump = {
  id: string;
  pumpNumber: string;
  brand?: string | null;
  status?: string | null;
  maintenanceDue?: boolean;
  createdBy: string;
  createdById: string;
  createdAt: any;
};

export default function EmployeePumpsPage() {
  const router = useRouter();

  // Stored on login
  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const pharmacyName =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_NAME")
      : null;

  const employeeId =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_ID")
      : null;

  const employeeName =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_NAME")
      : "UNKNOWN";

  const [pumpNumber, setPumpNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "maintenance" | "available">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* 🔐 Init */
  useEffect(() => {
    ensureAnonymousAuth();
    if (pharmacyId) {
      loadPumps();
    }
  }, []);

  /* 📦 Load pumps */
  async function loadPumps() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "pumps"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);

    const list: Pump[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const sorted = [...list].sort((a, b) => {
      const aMaintenance = a.status === "IN_MAINTENANCE" || a.maintenanceDue === true;
      const bMaintenance = b.status === "IN_MAINTENANCE" || b.maintenanceDue === true;

      if (aMaintenance !== bMaintenance) return aMaintenance ? -1 : 1;

      return String(a.pumpNumber || "").localeCompare(String(b.pumpNumber || ""));
    });

    setPumps(sorted);
  }

  /* ➕ Register pump */
  async function handleRegisterPump() {
    setError("");

    if (!pumpNumber) {
      setError("Pump number is required");
      return;
    }

    if (!employeeId || !pharmacyId) {
      setError("Missing employee or pharmacy context");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "pumps"), {
        pumpNumber,
        brand: brand || null,
        pharmacyId,
        pharmacyName,
        createdBy: employeeName,
        createdById: employeeId,
        active: true,
        status: "AVAILABLE", // ✅ NUEVO
        createdAt: serverTimestamp(),
      });

      setPumpNumber("");
      setBrand("");
      await loadPumps();
    } catch (err) {
      console.error(err);
      setError("Failed to register pump");
    } finally {
      setLoading(false);
    }
  }

  /* 🗑️ Delete pump */
  async function handleDeletePump(id: string) {
    if (!confirm("Delete this pump?")) return;

    await deleteDoc(doc(db, "pumps", id));
    await loadPumps();
  }

  const filteredPumps = pumps.filter((p) => {
    const inMaintenance = p.status === "IN_MAINTENANCE" || p.maintenanceDue === true;
    if (statusFilter === "maintenance") return inMaintenance;
    if (statusFilter === "available") return !inMaintenance;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-2xl space-y-8">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Medical Pumps
          </h1>
          <p className="text-sm text-white/60">
            Register and manage hospital medical pumps
          </p>
        </div>

        {/* REGISTER FORM */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">
            Register New Pump
          </h2>

          <input
            value={pumpNumber}
            onChange={(e) => setPumpNumber(normalizePumpScannerInput(e.target.value))}
            placeholder="Pump Number (type or scan barcode/QR)"
            className="w-full p-2 rounded bg-black border border-white/10"
          />

          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand (optional)"
            className="w-full p-2 rounded bg-black border border-white/10"
          />

          {error && (
            <p className="text-red-400 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={handleRegisterPump}
            disabled={loading}
            className="w-full bg-indigo-600 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? "REGISTERING..." : "REGISTER PUMP"}
          </button>
        </div>

        {/* LIST */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">
            Registered Pumps
          </h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`text-xs px-3 py-1 rounded border ${
                statusFilter === "all"
                  ? "bg-white/20 border-white/30"
                  : "bg-black/30 border-white/10"
              }`}
            >
              All ({pumps.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("maintenance")}
              className={`text-xs px-3 py-1 rounded border ${
                statusFilter === "maintenance"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                  : "bg-black/30 border-white/10"
              }`}
            >
              In Maintenance ({pumps.filter((p) => p.status === "IN_MAINTENANCE" || p.maintenanceDue === true).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={`text-xs px-3 py-1 rounded border ${
                statusFilter === "available"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                  : "bg-black/30 border-white/10"
              }`}
            >
              Available ({pumps.filter((p) => !(p.status === "IN_MAINTENANCE" || p.maintenanceDue === true)).length})
            </button>
          </div>

          {filteredPumps.length === 0 && (
            <p className="text-white/50 text-sm">
              No pumps found for this filter.
            </p>
          )}

          <ul className="space-y-3">
            {filteredPumps.map((p) => (
              <li
                key={p.id}
                className="border border-white/10 rounded p-4 flex justify-between items-start"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    Pump #{p.pumpNumber}
                  </p>

                  <p className="text-xs text-white/70">
                    Status:{" "}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border ${
                        p.status === "IN_MAINTENANCE" || p.maintenanceDue
                          ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                          : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                      }`}
                    >
                      {p.status === "IN_MAINTENANCE" || p.maintenanceDue
                        ? "IN_MAINTENANCE"
                        : "AVAILABLE"}
                    </span>
                  </p>

                  {p.brand && (
                    <p className="text-xs text-white/60">
                      Brand: {p.brand}
                    </p>
                  )}

                  <p className="text-xs text-white/50">
                    Registered by:{" "}
                    <span className="text-white/70">
                      {p.createdBy}
                    </span>
                  </p>

                  <p className="text-xs text-white/40">
                    Date (USA): {formatDate(p.createdAt)}
                  </p>
                </div>

                <button
                  onClick={() => handleDeletePump(p.id)}
                  className="text-xs text-red-400 hover:text-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* BACK */}
        <div className="text-center">
          <button
            onClick={() => router.push("/employee/dashboard")}
            className="text-xs text-white/50 hover:text-white"
          >
            ← Back to Employee Dashboard
          </button>
        </div>

      </div>
    </main>
  );
}
