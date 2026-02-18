import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function POST(req: Request) {
  let body: EmailPayload;
  try {
    body = (await req.json()) as EmailPayload;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  // Prefer sending via Resend when configured
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
          to: body.to,
          subject: body.subject,
          html: body.html,
          text: body.text,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        // save to outbox for manual/retry delivery
        try {
          await adminDb.collection("outbox_emails").add({
            to: body.to,
            subject: body.subject,
            html: body.html,
            text: body.text || null,
            provider: "resend",
            status: "QUEUED",
            error: errorText,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to persist outbox email:", e);
        }

        return NextResponse.json(
          { error: "Email send failed", details: errorText, queued: true },
          { status: 202 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error("Resend request failed:", err?.message || err);
      // persist to outbox
      try {
        await adminDb.collection("outbox_emails").add({
          to: body.to,
          subject: body.subject,
          html: body.html,
          text: body.text || null,
          provider: "resend",
          status: "QUEUED",
          error: String(err?.message || err),
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to persist outbox email:", e);
      }

      return NextResponse.json(
        { error: "Resend request failed", queued: true },
        { status: 202 }
      );
    }
  }

  // If Resend not configured, persist the email to outbox for manual sending
  try {
    await adminDb.collection("outbox_emails").add({
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text || null,
      provider: "none",
      status: "QUEUED",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: false, queued: true }, { status: 202 });
  } catch (err) {
    console.error("Failed to persist outbox email:", err);
    return NextResponse.json({ error: "Failed to queue email" }, { status: 500 });
  }
}
