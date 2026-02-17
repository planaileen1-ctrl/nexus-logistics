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

  useEffect(() => {
    const initNotifications = async () => {
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
