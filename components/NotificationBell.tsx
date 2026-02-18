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
  const [notifications, setNotifications] = useState<{ payload: any; read?: boolean; id: number }[]>([]);
  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isIos = typeof navigator !== "undefined" && /iP(hone|od|ad)/i.test(navigator.userAgent);
  const isInAppBrowser = typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Line|WhatsApp|Messenger|Twitter|LinkedIn/i.test(navigator.userAgent);
  const supportsPush = typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator && "Notification" in window;

  useEffect(() => {
    const initNotifications = async () => {
      if (isIos && !supportsPush) {
        setUnsupportedMessage(
          "iOS: web-push not supported on this OS version. Open this page in Safari or upgrade to iOS 16.4+."
        );
        return;
      }

      if (isInAppBrowser) {
        setUnsupportedMessage(
          "It looks like you're in an in-app browser. Open this link in Safari/Chrome to enable notifications."
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
      setNotifications((prev) => [{ payload, read: false, id: Date.now() + Math.random() }, ...prev].slice(0, 10));
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
                Open in external browser
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
            title="Enable notifications"
          >
            <Bell size={20} className="text-slate-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() =>
          setIsOpen((s) => {
            const next = !s;
            if (next) {
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            }
            return next;
          })
        }
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        title="Notifications"
      >
        <Bell size={20} className="text-white" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-sm bg-[#061018] border border-white/10 rounded-md p-2 z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Notifications</div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-white/60 px-2 py-1 rounded hover:bg-white/5"
            >
              Close
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-xs text-white/60 p-2">No notifications</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notifications.map((n, idx) => {
                const title = n.payload?.notification?.title || n.payload?.data?.title || "Notification";
                const body = n.payload?.notification?.body || n.payload?.data?.body || JSON.stringify(n.payload?.data || {});
                return (
                  <div key={n.id ?? idx} className="p-2 bg-black/20 rounded border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{title}</div>
                      {!n.read && <div className="text-[11px] text-emerald-300">new</div>}
                    </div>
                    <div className="text-xs text-white/60 mt-1">{body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
