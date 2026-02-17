import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { token, userId, role, pharmacyId } = await req.json();

    if (!token || !userId || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await adminDb.collection("notification_tokens").doc(userId).set(
      {
        token,
        userId,
        role,
        pharmacyId: pharmacyId || null,
        device: req.headers.get("user-agent") || "unknown",
        active: true,
        lastUsed: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error registering notification token:", error);
    return NextResponse.json(
      { error: "Failed to register token" },
      { status: 500 }
    );
  }
}
