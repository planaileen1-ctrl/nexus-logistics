import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

export async function POST(req: Request) {
  try {
    // admin-only endpoint: you can implement auth checks here if desired

    const now = Date.now();
    const cutoff = now - 20 * 24 * 60 * 60 * 1000; // 20 days

    const ordersSnap = await adminDb.collection("orders").where("status", "==", "DELIVERED").get();

    const toNotify: Array<{
      orderId: string;
      customerId?: string;
      customerEmail?: string;
      pumps: string[];
      deliveredAtMs: number;
    }> = [];

    for (const doc of ordersSnap.docs) {
      const data = doc.data() as any;
      const deliveredAtMs = toMillis(data.deliveredAtMs || data.deliveredAt || data.deliveredAtISO || data.deliveredAtMs);

      if (!deliveredAtMs) continue;
      if (deliveredAtMs > cutoff) continue; // not yet 20 days

      const returnEntries = (data.previousPumpsReturnToPharmacy || []) as any[];
      const pending = returnEntries.filter((e) => e?.returnedToPharmacy !== true).map((e) => String(e.pumpNumber));
      if (!pending || pending.length === 0) continue;

      const customerId = data.customerId;
      let customerEmail: string | undefined = data.customerEmail;

      if (!customerEmail && customerId) {
        try {
          const custSnap = await adminDb.collection("customers").doc(customerId).get();
          if (custSnap.exists) customerEmail = custSnap.data()?.email;
        } catch (e) {
          console.warn("Failed to load customer for overdue check:", e);
        }
      }

      toNotify.push({
        orderId: doc.id,
        customerId,
        customerEmail,
        pumps: pending,
        deliveredAtMs,
      });
    }

    // Send emails and persist notifications to avoid duplicates
    const results: any[] = [];

    for (const item of toNotify) {
      if (!item.customerEmail) {
        results.push({ orderId: item.orderId, skipped: true, reason: "no-customer-email" });
        continue;
      }

      // Skip if we've already sent an overdue notification for this order
      const already = await adminDb.collection("overdue_notifications").where("orderId", "==", item.orderId).get();
      if (!already.empty) {
        results.push({ orderId: item.orderId, skipped: true, reason: "already-notified" });
        continue;
      }

      const daysOver = Math.max(1, Math.floor((Date.now() - item.deliveredAtMs) / (24 * 60 * 60 * 1000)));

      const subject = `Reminder: Pumps not returned (${item.pumps.join(", ")})`;
      const html = `
        <p>Hello,</p>
        <p>Our records show the following pump(s) from your recent delivery (order ${item.orderId}) have not been returned to the pharmacy:</p>
        <ul>${item.pumps.map((p) => `<li>Pump #${p}</li>`).join("")}</ul>
        <p>These pumps are <strong>${daysOver} day(s)</strong> overdue for return. Please return them on your next delivery or contact the pharmacy.</p>
        <p>Thank you,<br/>Nexus Logistics</p>
      `;

      // Attempt to send via Resend if configured
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM;

      let sendOk = false;
      let sendError: string | null = null;

      if (apiKey && from) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: item.customerEmail,
              subject,
              html,
            }),
          });

          if (!res.ok) {
            sendError = await res.text();
          } else {
            sendOk = true;
          }
        } catch (err: any) {
          sendError = String(err?.message || err);
        }
      }

      // Persist to outbox if send failed or Resend not configured
      if (!sendOk) {
        try {
          await adminDb.collection("outbox_emails").add({
            to: item.customerEmail,
            subject,
            html,
            text: `Pumps not returned: ${item.pumps.join(", ")}. Overdue: ${daysOver} day(s).`,
            provider: apiKey && from ? "resend" : "none",
            status: sendOk ? "SENT" : "QUEUED",
            error: sendError || null,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to queue outbox email:", e);
        }
      }

      // record that we notified for this order (prevent duplicates)
      try {
        await adminDb.collection("overdue_notifications").add({
          orderId: item.orderId,
          customerId: item.customerId || null,
          customerEmail: item.customerEmail || null,
          pumps: item.pumps,
          daysOver,
          notifiedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to persist overdue notification record:", e);
      }

      results.push({ orderId: item.orderId, emailed: sendOk, queued: !sendOk, error: sendError });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("overdue-pumps job failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to run the overdue pumps notification job" });
}
