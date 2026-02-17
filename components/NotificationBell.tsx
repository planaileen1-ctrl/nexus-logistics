"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { requestNotificationPermission, saveNotificationToken, listenToNotifications } from "@/lib/pushNotifications";

interface NotificationBellProps {
  userId: string;
  role: "DRIVER" | "EMPLOYEE" | "PHARMACY_ADMIN" | "ADMIN";
  pharmacyId?: string;
}

export default function NotificationBell({ userId, role, pharmacyId }: NotificationBellProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(null);

  const isIos = typeof navigator !== "undefined" && /iP(hone|od|ad)/i.test(navigator.userAgent);
  const isInAppBrowser = typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Line|WhatsApp|Messenger|Twitter|LinkedIn/i.test(navigator.userAgent);
  const supportsPush = typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator && "Notification" in window;

  useEffect(() => {
    const initNotifications = async () => {
      if (isIos && !supportsPush) {
        setUnsupportedMessage(
          "iOS: web-push no soportado en esta versión del sistema. Abra esta página en Safari o actualice a iOS 16.4+."
        );
        return;
      }

      if (isInAppBrowser) {
        setUnsupportedMessage(
          "Parece que estás en el navegador dentro de otra app. Abre este enlace en Safari/Chrome para activar notificaciones."
        );
        // still allow user to click to open in external browser
        return;
      }

      const token = await requestNotificationPermission();
      if (token) {
        setHasPermission(true);
        await saveNotificationToken(token, userId, role, pharmacyId);
      }
    };

    initNotifications();

    listenToNotifications((payload) => {
      setNotifications((prev) => [payload, ...prev].slice(0, 10));
    });
  }, [userId, role, pharmacyId]);

  if (!hasPermission) {
    return (
      <div>
        {unsupportedMessage ? (
          <div className="text-xs text-yellow-300">
            <p>{unsupportedMessage}</p>
            <div className="mt-1">
              <button
                onClick={() => {
                  try {
                    window.open(window.location.href, "_blank");
                  } catch (e) {
                    // ignore
                  }
                }}
                className="text-xs underline"
              >
                Abrir en navegador externo
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={async () => {
              const token = await requestNotificationPermission();
              if (token) {
                setHasPermission(true);
                await saveNotificationToken(token, userId, role, pharmacyId);
              }
            }}
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Activar notificaciones"
          >
            <Bell size={20} className="text-slate-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
        <Bell size={20} className="text-white" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        )}
      </button>
    </div>
  );
}
