import { NextResponse } from "next/server";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY or RESEND_FROM" },
      { status: 500 }
    );
  }

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
    return NextResponse.json(
      { error: "Email send failed", details: errorText },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
