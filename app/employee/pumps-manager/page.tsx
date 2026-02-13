/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Pumps Manager
 * View customer pump history and send return reminders
 *
 * Last verified: 2026-02-13
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

type Customer = {
  id: string;
  name: string;
  city?: string;
  returnReminderNote?: string;
};

type Order = {
  id: string;
  customerId: string;
  customerName: string;
  pumpNumbers: string[];
};

export default function PumpsManagerPage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const employeeName =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_NAME")
      : "UNKNOWN";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;
      await loadCustomers();
      await loadOrders();
    })();
  }, []);

  async function loadCustomers() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "customers"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      name: d.data().customerName,
      city: d.data().city,
      returnReminderNote: d.data().returnReminderNote || "",
    }));

    setCustomers(list);

    const initialNotes: Record<string, string> = {};
    list.forEach((c) => {
      initialNotes[c.id] = c.returnReminderNote || "";
    });

    setNotes(initialNotes);
  }

  async function loadOrders() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "orders"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);
    setOrders(
      snap.docs.map((d) => ({
        id: d.id,
        customerId: d.data().customerId,
        customerName: d.data().customerName,
        pumpNumbers: d.data().pumpNumbers || [],
      }))
    );
  }

  const customerPumps = customers.map((c) => {
    const pumpSet = new Set<string>();
    orders
      .filter((o) => o.customerId === c.id)
      .forEach((o) => {
        (o.pumpNumbers || []).forEach((num) => {
          if (num) pumpSet.add(String(num));
        });
      });

    return {
      ...c,
      pumps: Array.from(pumpSet),
    };
  });

  async function handleSaveReminder(customerId: string) {
    if (!pharmacyId) return;

    setError("");
    setInfo("");
    setLoading(true);

    try {
      await updateDoc(doc(db, "customers", customerId), {
        returnReminderNote: notes[customerId] || "",
        returnReminderAt: serverTimestamp(),
        returnReminderBy: employeeName,
      });

      setInfo("Return reminder saved.");
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      console.error("handleSaveReminder error:", err);
      setError("Failed to save reminder.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearReminder(customerId: string) {
    if (!pharmacyId) return;

    setError("");
    setInfo("");
    setLoading(true);

    try {
      await updateDoc(doc(db, "customers", customerId), {
        returnReminderNote: "",
        returnReminderAt: serverTimestamp(),
        returnReminderBy: employeeName,
      });

      setNotes((prev) => ({ ...prev, [customerId]: "" }));
      setInfo("Return reminder cleared.");
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      console.error("handleClearReminder error:", err);
      setError("Failed to clear reminder.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pumps Manager</h1>
          <p className="text-sm text-white/60">
            Track customer pumps and send return reminders
          </p>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {info && <p className="text-green-400 text-sm text-center">{info}</p>}

        <div className="space-y-4">
          {customerPumps.map((c) => (
            <div
              key={c.id}
              className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-lg font-semibold">{c.name}</p>
                  {c.city && (
                    <p className="text-xs text-white/50">{c.city}</p>
                  )}
                </div>
                <div className="text-xs text-white/40">
                  Based on order history
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Known Pumps</p>
                {c.pumps.length === 0 && (
                  <p className="text-xs text-white/60">No pumps found.</p>
                )}
                {c.pumps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {c.pumps.map((num) => (
                      <span
                        key={num}
                        className="bg-white/10 text-xs px-3 py-1 rounded"
                      >
                        Pump #{num}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Return Reminder</p>
                <textarea
                  value={notes[c.id] || ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  placeholder="Add a reminder for the next delivery"
                  className="w-full p-2 rounded bg-black border border-white/10 text-sm"
                  rows={3}
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleSaveReminder(c.id)}
                    disabled={loading}
                    className="px-3 py-2 text-xs bg-blue-600 rounded disabled:opacity-50"
                  >
                    Save Reminder
                  </button>
                  <button
                    onClick={() => handleClearReminder(c.id)}
                    disabled={loading}
                    className="px-3 py-2 text-xs bg-gray-700 rounded disabled:opacity-50"
                  >
                    Clear Reminder
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

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
