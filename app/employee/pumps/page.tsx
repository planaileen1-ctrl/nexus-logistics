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
  updateDoc,
  onSnapshot,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { normalizePumpScannerInput } from "@/lib/pumpScanner";
import AdminModeBadge from "@/components/AdminModeBadge";

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

/* 🔹 Helper: format Firestore timestamp to USA date */
function formatDate(ts: any) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-US", DATE_TIME_FORMAT);
}

function formatUsDateOnly(value?: string | null) {
  if (!value) return "—";

  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateOnly.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function normalizeUsDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const candidate = new Date(year, month - 1, day);
  const isValid =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day;

  if (!isValid) return null;

  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

function formatUsDateTyping(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const LAST_MAINTENANCE_DATE_ERROR = "Last Maintenance Date must be in MM/DD/YYYY format";

type Pump = {
  id: string;
  pumpNumber: string;
  brand?: string | null;
  lastMaintenanceDate?: string | null;
  status?: string | null;
  maintenanceDue?: boolean;
  createdBy: string;
  createdById: string;
  createdAt: any;
};

function getNormalizedPumpStatus(pump: Pump) {
  const rawStatus = String(pump.status || "AVAILABLE").trim().toUpperCase();
  const inMaintenance = rawStatus === "IN_MAINTENANCE" || pump.maintenanceDue === true;
  const isAvailable = rawStatus === "AVAILABLE" && pump.maintenanceDue !== true;
  const isInUse = !inMaintenance && !isAvailable;

  return {
    rawStatus,
    inMaintenance,
    isAvailable,
    isInUse,
    displayStatus: inMaintenance ? "IN_MAINTENANCE" : rawStatus,
  };
}

function getStatusBadgeClass(displayStatus: string) {
  if (displayStatus === "IN_MAINTENANCE") {
    return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  }

  if (displayStatus === "AVAILABLE") {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }

  return "text-cyan-300 border-cyan-500/40 bg-cyan-500/10";
}

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
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState("");
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "maintenance" | "available" | "in_use">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);
  const [editingPumpId, setEditingPumpId] = useState<string | null>(null);
  const [editingPumpNumber, setEditingPumpNumber] = useState("");
  const [editingPumpBrand, setEditingPumpBrand] = useState("");
  const [editingLastMaintenanceDate, setEditingLastMaintenanceDate] = useState("");

  function validateRegisterLastMaintenanceDateOnBlur() {
    const value = lastMaintenanceDate.trim();
    if (!value) return;

    const normalized = normalizeUsDateInput(value);
    if (!normalized) {
      setError(LAST_MAINTENANCE_DATE_ERROR);
      return;
    }

    setLastMaintenanceDate(normalized);
    setError((prev) => (prev === LAST_MAINTENANCE_DATE_ERROR ? "" : prev));
  }

  function validateEditLastMaintenanceDateOnBlur() {
    const value = editingLastMaintenanceDate.trim();
    if (!value) return;

    const normalized = normalizeUsDateInput(value);
    if (!normalized) {
      setError(LAST_MAINTENANCE_DATE_ERROR);
      return;
    }

    setEditingLastMaintenanceDate(normalized);
    setError((prev) => (prev === LAST_MAINTENANCE_DATE_ERROR ? "" : prev));
  }

  function sortPumps(list: Pump[]) {
    return [...list].sort((a, b) => {
      const aInfo = getNormalizedPumpStatus(a);
      const bInfo = getNormalizedPumpStatus(b);

      const getRank = (info: ReturnType<typeof getNormalizedPumpStatus>) => {
        if (info.inMaintenance) return 0;
        if (!info.isAvailable) return 1;
        return 2;
      };

      const aRank = getRank(aInfo);
      const bRank = getRank(bInfo);

      if (aRank !== bRank) return aRank - bRank;

      return String(a.pumpNumber || "").localeCompare(String(b.pumpNumber || ""));
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPharmacyAdmin(localStorage.getItem("EMPLOYEE_ROLE") === "PHARMACY_ADMIN");
  }, []);

  /* 🔐 Init */
  useEffect(() => {
    let unsub: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "pumps"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsub = onSnapshot(q, (snap) => {
        const list: Pump[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setPumps(sortPumps(list));
      });
    })();

    return () => {
      if (unsub) unsub();
    };
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

    setPumps(sortPumps(list));
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

    const normalizedLastMaintenanceDate = normalizeUsDateInput(lastMaintenanceDate);
    if (lastMaintenanceDate.trim() && !normalizedLastMaintenanceDate) {
      setError(LAST_MAINTENANCE_DATE_ERROR);
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "pumps"), {
        pumpNumber,
        brand: brand || null,
        lastMaintenanceDate: normalizedLastMaintenanceDate,
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
      setLastMaintenanceDate("");
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
    if (!isPharmacyAdmin) return;
    if (!confirm("Delete this pump?")) return;

    await deleteDoc(doc(db, "pumps", id));
    await loadPumps();
  }

  function handleStartEditPump(pump: Pump) {
    if (!isPharmacyAdmin) return;
    setError("");
    setEditingPumpId(pump.id);
    setEditingPumpNumber(String(pump.pumpNumber || ""));
    setEditingPumpBrand(String(pump.brand || ""));
    setEditingLastMaintenanceDate(String(pump.lastMaintenanceDate || ""));
  }

  function handleCancelEditPump() {
    setEditingPumpId(null);
    setEditingPumpNumber("");
    setEditingPumpBrand("");
    setEditingLastMaintenanceDate("");
  }

  async function handleSaveEditPump(id: string) {
    if (!isPharmacyAdmin) return;
    setError("");

    const normalizedPumpNumber = normalizePumpScannerInput(editingPumpNumber).trim();
    if (!normalizedPumpNumber) {
      setError("Pump number is required");
      return;
    }

    const normalizedLastMaintenanceDate = normalizeUsDateInput(editingLastMaintenanceDate);
    if (editingLastMaintenanceDate.trim() && !normalizedLastMaintenanceDate) {
      setError(LAST_MAINTENANCE_DATE_ERROR);
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "pumps", id), {
        pumpNumber: normalizedPumpNumber,
        brand: editingPumpBrand.trim() || null,
        lastMaintenanceDate: normalizedLastMaintenanceDate,
      });

      handleCancelEditPump();
      await loadPumps();
    } catch (err) {
      console.error(err);
      setError("Failed to update pump");
    } finally {
      setLoading(false);
    }
  }

  const filteredPumps = pumps.filter((p) => {
    const statusInfo = getNormalizedPumpStatus(p);
    if (statusFilter === "maintenance") return statusInfo.inMaintenance;
    if (statusFilter === "available") return statusInfo.isAvailable;
    if (statusFilter === "in_use") return statusInfo.isInUse;
    return true;
  });

  const maintenanceCount = pumps.filter((p) => getNormalizedPumpStatus(p).inMaintenance).length;
  const availableCount = pumps.filter((p) => getNormalizedPumpStatus(p).isAvailable).length;
  const inUseCount = pumps.filter((p) => getNormalizedPumpStatus(p).isInUse).length;

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
          <AdminModeBadge />
          <div>
            <button
              type="button"
              onClick={() => router.push("/employee/e-kit")}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              → Open E-KIT Register
            </button>
          </div>
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

          <p className="text-xs text-white/60">Last Maintenance Date (optional)</p>
          <input
            type="text"
            value={lastMaintenanceDate}
            onChange={(e) => setLastMaintenanceDate(formatUsDateTyping(e.target.value))}
            onBlur={validateRegisterLastMaintenanceDateOnBlur}
            placeholder="MM/DD/YYYY"
            inputMode="numeric"
            maxLength={10}
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
              In Maintenance ({maintenanceCount})
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
              Available ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("in_use")}
              className={`text-xs px-3 py-1 rounded border ${
                statusFilter === "in_use"
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200"
                  : "bg-black/30 border-white/10"
              }`}
            >
              In Use ({inUseCount})
            </button>
          </div>

          {filteredPumps.length === 0 && (
            <p className="text-white/50 text-sm">
              No pumps found for this filter.
            </p>
          )}

          <ul className="space-y-3">
            {filteredPumps.map((p) => (
              (() => {
                const statusInfo = getNormalizedPumpStatus(p);
                return (
              <li
                key={p.id}
                className="border border-white/10 rounded p-4 flex justify-between items-start"
              >
                <div className="space-y-1">
                  {isPharmacyAdmin && editingPumpId === p.id ? (
                    <div className="space-y-2">
                      <input
                        value={editingPumpNumber}
                        onChange={(e) => setEditingPumpNumber(normalizePumpScannerInput(e.target.value))}
                        placeholder="Pump Number"
                        className="w-full max-w-xs p-2 rounded bg-black border border-white/10 text-sm"
                      />
                      <input
                        value={editingPumpBrand}
                        onChange={(e) => setEditingPumpBrand(e.target.value)}
                        placeholder="Brand (optional)"
                        className="w-full max-w-xs p-2 rounded bg-black border border-white/10 text-sm"
                      />
                      <p className="text-xs text-white/60">Last Maintenance Date (optional)</p>
                      <input
                        type="text"
                        value={editingLastMaintenanceDate}
                        onChange={(e) => setEditingLastMaintenanceDate(formatUsDateTyping(e.target.value))}
                        onBlur={validateEditLastMaintenanceDateOnBlur}
                        placeholder="MM/DD/YYYY"
                        inputMode="numeric"
                        maxLength={10}
                        className="w-full max-w-xs p-2 rounded bg-black border border-white/10 text-sm"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">
                      Pump #{p.pumpNumber}
                    </p>
                  )}

                  <p className="text-xs text-white/70">
                    Status:{" "}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border ${getStatusBadgeClass(statusInfo.displayStatus)}`}
                    >
                      {statusInfo.displayStatus}
                    </span>
                  </p>

                  {p.brand && editingPumpId !== p.id && (
                    <p className="text-xs text-white/60">
                      Brand: {p.brand}
                    </p>
                  )}

                  {p.lastMaintenanceDate && editingPumpId !== p.id && (
                    <p className="text-xs text-white/60">
                      Last Maintenance Date:{" "}
                      <span className="text-emerald-300">{formatUsDateOnly(p.lastMaintenanceDate)}</span>
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

                {isPharmacyAdmin && (
                  <div className="flex flex-col items-end gap-2">
                    {editingPumpId === p.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEditPump(p.id)}
                          disabled={loading}
                          className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditPump}
                          disabled={loading}
                          className="text-xs text-white/60 hover:text-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartEditPump(p)}
                        className="text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        Edit
                      </button>
                    )}

                    <button
                      onClick={() => handleDeletePump(p.id)}
                      className="text-xs text-red-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
                );
              })()
            ))}
          </ul>
        </div>

        {/* BACK */}
        <div className="text-center">
          <button
            onClick={() =>
              router.push(
                localStorage.getItem("EMPLOYEE_ROLE") === "PHARMACY_ADMIN"
                  ? "/pharmacy/dashboard"
                  : "/employee/dashboard"
              )
            }
            className="text-xs text-white/50 hover:text-white"
          >
            {isPharmacyAdmin ? "← Back to Pharmacy Dashboard" : "← Back to Employee Dashboard"}
          </button>
        </div>

      </div>
    </main>
  );
}
