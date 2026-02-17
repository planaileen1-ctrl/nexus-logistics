import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tokenDoc = await adminDb.collection("notification_tokens").doc(userId).get();
    
    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: "No notification token found for user" },
        { status: 404 }
      );
    }

    const { token } = tokenDoc.data() as { token: string };

    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token,
    };

    await admin.messaging().send(message);

    await adminDb.collection("notification_history").add({
      userId,
      title,
      body,
      data: data || {},
      sentAt: new Date().toISOString(),
      status: "SENT",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
