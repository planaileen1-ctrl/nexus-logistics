"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { sendAppEmail } from "@/lib/emailClient";

type DeliveryBackup = {
  id: string;
  customerName?: string;
  driverName?: string;
  deliveredAt?: any;
  deliveredAtISO?: string;
  statusUpdatedAt?: any;
  createdAt?: any;
  legalPdfUrl?: string;
  status?: string;
};

function formatDate(ts: any) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("en-US");
  if (ts?.toDate) return ts.toDate().toLocaleString("en-US");
  return "—";
}

export default function EmployeeDeliveryPdfsPage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const [deliveryBackups, setDeliveryBackups] = useState<DeliveryBackup[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pdfEmailByOrder, setPdfEmailByOrder] = useState<Record<string, string>>({});
  const [pdfSendingByOrder, setPdfSendingByOrder] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let unsub: null | (() => void) = null;

    (async () => {
      await ensureAnonymousAuth();
      if (!pharmacyId) return;

      const q = query(
        collection(db, "orders"),
        where("pharmacyId", "==", pharmacyId)
      );

      unsub = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (o) =>
              !!o.legalPdfUrl &&
              (o.status === "DELIVERED" || o.deliveredAt || o.deliveredAtISO)
          )
          .sort((a, b) => {
            const toMs = (ts: any) => {
              if (!ts) return 0;
              if (typeof ts === "string") return new Date(ts).getTime();
              if (ts?.toDate) return ts.toDate().getTime();
              return 0;
            };

            return (
              toMs(b.deliveredAt || b.deliveredAtISO || b.statusUpdatedAt || b.createdAt) -
              toMs(a.deliveredAt || a.deliveredAtISO || a.statusUpdatedAt || a.createdAt)
            );
          })
          .slice(0, 20);

        setDeliveryBackups(list);
      });
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [pharmacyId]);

  async function handleSharePdfByEmail(backup: DeliveryBackup) {
    if (!backup.legalPdfUrl) {
      setError("PDF is not available yet.");
      return;
    }

    const normalizedTo = (pdfEmailByOrder[backup.id] || "").trim();
    if (!normalizedTo) {
      setError("Please enter recipient email first.");
      return;
    }

    if (!normalizedTo.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setPdfSendingByOrder((prev) => ({ ...prev, [backup.id]: true }));

    try {
      await sendAppEmail({
        to: normalizedTo,
        subject: `Delivery PDF - Order ${backup.id}`,
        html: `
          <p>Hello,</p>
          <p>Here is the legal delivery PDF backup for order <strong>${backup.id}</strong>.</p>
          <p><a href="${backup.legalPdfUrl}" target="_blank" rel="noreferrer">Open Delivery PDF</a></p>
        `,
        text: `Delivery PDF backup for order ${backup.id}: ${backup.legalPdfUrl}`,
      });

      setInfo(`PDF shared by email to ${normalizedTo}.`);
      setPdfEmailByOrder((prev) => ({ ...prev, [backup.id]: "" }));
      setTimeout(() => setInfo(""), 6000);
    } finally {
      setPdfSendingByOrder((prev) => ({ ...prev, [backup.id]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Delivery PDF Backups</h1>
          <p className="text-sm text-white/60">
            View and share legal delivery PDF records
          </p>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {info && <p className="text-green-400 text-sm text-center">{info}</p>}

        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-6">
          {deliveryBackups.length === 0 && (
            <p className="text-xs text-white/60">No delivery PDFs available yet.</p>
          )}
          {deliveryBackups.length > 0 && (
            <ul className="space-y-3">
              {deliveryBackups.map((o) => (
                <li
                  key={`backup-${o.id}`}
                  className="border border-cyan-500/20 rounded p-4 space-y-1"
                >
                  <p className="text-sm font-semibold">{o.customerName || "Customer"}</p>
                  <p className="text-xs text-white/60">Driver: {o.driverName || "Unassigned"}</p>
                  <p className="text-xs text-white/50">
                    Delivered: {formatDate(o.deliveredAt || o.deliveredAtISO || o.statusUpdatedAt || o.createdAt)}
                  </p>
                  <a
                    href={o.legalPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500"
                  >
                    VIEW PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => handleSharePdfByEmail(o)}
                    disabled={pdfSendingByOrder[o.id] === true}
                    className="ml-2 text-xs px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {pdfSendingByOrder[o.id] ? "SENDING..." : "SHARE BY EMAIL"}
                  </button>
                  <input
                    type="email"
                    value={pdfEmailByOrder[o.id] || ""}
                    onChange={(e) =>
                      setPdfEmailByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))
                    }
                    placeholder="recipient@email.com"
                    className="mt-2 w-full p-2 rounded bg-black border border-white/10 text-xs"
                  />
                </li>
              ))}
            </ul>
          )}
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
