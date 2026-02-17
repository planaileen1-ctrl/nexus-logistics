/**
 * Push Notifications Service
 * Firebase Cloud Messaging (FCM)
 * 
 * Funcionalidad completamente nueva - No modifica código existente
 */

import { getMessaging, getToken, onMessage } from "firebase/messaging";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }

    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch (error) {
    console.error("Error getting notification permission:", error);
    return null;
  }
}

export async function saveNotificationToken(
  token: string,
  userId: string,
  role: "DRIVER" | "EMPLOYEE" | "PHARMACY_ADMIN" | "ADMIN",
  pharmacyId?: string
) {
  try {
    await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId, role, pharmacyId }),
    });
  } catch (error) {
    console.error("Error saving notification token:", error);
  }
}

export function listenToNotifications(callback: (payload: any) => void) {
  if (typeof window === "undefined") return;

  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      callback(payload);
    });
  } catch (error) {
    console.error("Error listening to notifications:", error);
  }
}

export async function sendPushNotification({
  userId,
  title,
  body,
  data,
}: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, body, data }),
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}
