type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendAppEmail(payload: EmailPayload) {
  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn("Email send failed:", errorText);
    }
  } catch (err) {
    console.warn("Email send error:", err);
  }
}
