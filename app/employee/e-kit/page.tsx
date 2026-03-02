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

function formatDate(ts: any) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-US", DATE_TIME_FORMAT);
}

type EKit = {
  id: string;
  kitCode: string;
  additionalCode?: string | null;
  status?: string | null;
  createdBy: string;
  createdById: string;
  createdAt: any;
};

function getNormalizedKitStatus(kit: EKit) {
  const rawStatus = String(kit.status || "AVAILABLE").trim().toUpperCase();
  const isAvailable = rawStatus === "AVAILABLE";
  const isInUse = !isAvailable;

  return {
    rawStatus,
    isAvailable,
    isInUse,
    displayStatus: rawStatus,
  };
}

function getStatusBadgeClass(displayStatus: string) {
  if (displayStatus === "AVAILABLE") {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }

  return "text-cyan-300 border-cyan-500/40 bg-cyan-500/10";
}

export default function EmployeeEkitPage() {
  const router = useRouter();

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

  const [kitCode, setKitCode] = useState("");
  const [additionalCode, setAdditionalCode] = useState("");
  const [kits, setKits] = useState<EKit[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "in_use">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [editingKitCode, setEditingKitCode] = useState("");
  const [editingAdditionalCode, setEditingAdditionalCode] = useState("");

  function sortKits(list: EKit[]) {
    return [...list].sort((a, b) => {
      const aInfo = getNormalizedKitStatus(a);
      const bInfo = getNormalizedKitStatus(b);

      const getRank = (info: ReturnType<typeof getNormalizedKitStatus>) => {
        if (!info.isAvailable) return 0;
        return 1;
      };

      const aRank = getRank(aInfo);
      const bRank = getRank(bInfo);

      if (aRank !== bRank) return aRank - bRank;

      return String(a.kitCode || "").localeCompare(String(b.kitCode || ""));
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPharmacyAdmin(localStorage.getItem("EMPLOYEE_ROLE") === "PHARMACY_ADMIN");
  }, []);

  useEffect(() => {
    let unsub: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "eKits"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsub = onSnapshot(q, (snap) => {
        const list: EKit[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setKits(sortKits(list));
      });
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  async function loadKits() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "eKits"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);

    const list: EKit[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    setKits(sortKits(list));
  }

  async function handleRegisterKit() {
    setError("");

    const normalizedKitCode = normalizePumpScannerInput(kitCode).trim();
    if (!normalizedKitCode) {
      setError("E-KIT code is required");
      return;
    }

    if (!employeeId || !pharmacyId) {
      setError("Missing employee or pharmacy context");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "eKits"), {
        kitCode: normalizedKitCode,
        additionalCode: normalizePumpScannerInput(additionalCode).trim() || null,
        pharmacyId,
        pharmacyName,
        createdBy: employeeName,
        createdById: employeeId,
        active: true,
        status: "AVAILABLE",
        createdAt: serverTimestamp(),
      });

      setKitCode("");
      setAdditionalCode("");
      await loadKits();
    } catch (err) {
      console.error(err);
      setError("Failed to register E-KIT");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteKit(id: string) {
    if (!isPharmacyAdmin) return;
    if (!confirm("Delete this E-KIT?")) return;

    await deleteDoc(doc(db, "eKits", id));
    await loadKits();
  }

  function handleStartEditKit(kit: EKit) {
    if (!isPharmacyAdmin) return;
    setError("");
    setEditingKitId(kit.id);
    setEditingKitCode(String(kit.kitCode || ""));
    setEditingAdditionalCode(String(kit.additionalCode || ""));
  }

  function handleCancelEditKit() {
    setEditingKitId(null);
    setEditingKitCode("");
    setEditingAdditionalCode("");
  }

  async function handleSaveEditKit(id: string) {
    if (!isPharmacyAdmin) return;
    setError("");

    const normalizedKitCode = normalizePumpScannerInput(editingKitCode).trim();
    if (!normalizedKitCode) {
      setError("E-KIT code is required");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "eKits", id), {
        kitCode: normalizedKitCode,
        additionalCode: normalizePumpScannerInput(editingAdditionalCode).trim() || null,
      });

      handleCancelEditKit();
      await loadKits();
    } catch (err) {
      console.error(err);
      setError("Failed to update E-KIT");
    } finally {
      setLoading(false);
    }
  }

  const filteredKits = kits.filter((kit) => {
    const statusInfo = getNormalizedKitStatus(kit);
    if (statusFilter === "available") return statusInfo.isAvailable;
    if (statusFilter === "in_use") return statusInfo.isInUse;
    return true;
  });

  const availableCount = kits.filter((k) => getNormalizedKitStatus(k).isAvailable).length;
  const inUseCount = kits.filter((k) => getNormalizedKitStatus(k).isInUse).length;

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">E-KIT</h1>
          <p className="text-sm text-white/60">
            Register and manage urgent supply boxes
          </p>
          <AdminModeBadge />
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Register New E-KIT</h2>

          <input
            value={kitCode}
            onChange={(e) => setKitCode(normalizePumpScannerInput(e.target.value))}
            placeholder="E-KIT Code (type or scan barcode/QR)"
            className="w-full p-2 rounded bg-black border border-white/10"
          />

          <input
            value={additionalCode}
            onChange={(e) => setAdditionalCode(normalizePumpScannerInput(e.target.value))}
            placeholder="Additional Code (optional)"
            className="w-full p-2 rounded bg-black border border-white/10"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleRegisterKit}
            disabled={loading}
            className="w-full bg-indigo-600 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? "REGISTERING..." : "REGISTER E-KIT"}
          </button>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Registered E-KITs</h2>

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
              All ({kits.length})
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

          {filteredKits.length === 0 && (
            <p className="text-white/50 text-sm">No E-KITs found for this filter.</p>
          )}

          <ul className="space-y-3">
            {filteredKits.map((kit) => {
              const statusInfo = getNormalizedKitStatus(kit);
              return (
                <li
                  key={kit.id}
                  className="border border-white/10 rounded p-4 flex justify-between items-start"
                >
                  <div className="space-y-1">
                    {isPharmacyAdmin && editingKitId === kit.id ? (
                      <div className="space-y-2">
                        <input
                          value={editingKitCode}
                          onChange={(e) => setEditingKitCode(normalizePumpScannerInput(e.target.value))}
                          placeholder="E-KIT Code"
                          className="w-full max-w-xs p-2 rounded bg-black border border-white/10 text-sm"
                        />
                        <input
                          value={editingAdditionalCode}
                          onChange={(e) => setEditingAdditionalCode(normalizePumpScannerInput(e.target.value))}
                          placeholder="Additional Code (optional)"
                          className="w-full max-w-xs p-2 rounded bg-black border border-white/10 text-sm"
                        />
                      </div>
                    ) : (
                      <p className="font-medium">E-KIT #{kit.kitCode}</p>
                    )}

                    <p className="text-xs text-white/70">
                      Status:{" "}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border ${getStatusBadgeClass(statusInfo.displayStatus)}`}
                      >
                        {statusInfo.displayStatus}
                      </span>
                    </p>

                    {kit.additionalCode && editingKitId !== kit.id && (
                      <p className="text-xs text-white/60">Additional Code: {kit.additionalCode}</p>
                    )}

                    <p className="text-xs text-white/50">
                      Registered by: <span className="text-white/70">{kit.createdBy}</span>
                    </p>

                    <p className="text-xs text-white/40">Date (USA): {formatDate(kit.createdAt)}</p>
                  </div>

                  {isPharmacyAdmin && (
                    <div className="flex flex-col items-end gap-2">
                      {editingKitId === kit.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEditKit(kit.id)}
                            disabled={loading}
                            className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditKit}
                            disabled={loading}
                            className="text-xs text-white/60 hover:text-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartEditKit(kit)}
                          className="text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteKit(kit.id)}
                        className="text-xs text-red-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

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
