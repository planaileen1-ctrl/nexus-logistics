# 📱 Sistema de Push Notifications

## ✅ Implementación Completada

Sistema de notificaciones push usando Firebase Cloud Messaging (FCM).
**NO modifica ningún archivo existente** - Funcionalidad completamente nueva.

---

## 📦 Archivos Creados

```
lib/
  └── pushNotifications.ts              ✅ Servicio principal

app/api/notifications/
  ├── register-token/route.ts           ✅ Registrar token FCM
  └── send/route.ts                     ✅ Enviar notificación

components/
  └── NotificationBell.tsx              ✅ UI opcional

public/
  └── firebase-messaging-sw.js          ✅ Service Worker
```

---

## 🔧 Configuración Necesaria

### 1. Variables de Entorno

Agregar a `.env.local`:

```bash
# Firebase Cloud Messaging
NEXT_PUBLIC_FIREBASE_VAPID_KEY="TU_VAPID_KEY_AQUI"
```

**Obtener VAPID Key:**
1. Ve a Firebase Console → Project Settings
2. Cloud Messaging tab
3. Web Push certificates
4. Generate key pair
5. Copia la clave

### 2. Habilitar FCM en Firebase

1. Firebase Console → Project Settings
2. Cloud Messaging tab
3. Habilitar "Cloud Messaging API (Legacy)" si no está activo

### 3. Actualizar Firestore Rules

Agregar a `firestore.rules`:

```javascript
match /notification_tokens/{tokenId} {
  allow read: if isSignedIn();
  allow write: if isSignedIn() && request.resource.data.userId == tokenId;
}

match /notification_history/{historyId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if false;
}
```

---

## 🚀 Cómo Usar (Opcional - No Obligatorio)

### Opción 1: Agregar Campana de Notificaciones

En cualquier dashboard (driver/employee/pharmacy), agregar:

```typescript
import NotificationBell from "@/components/NotificationBell";

// Dentro del componente
<NotificationBell 
  userId={driverId} 
  role="DRIVER" 
/>
```

### Opción 2: Enviar Notificación Manualmente

Desde cualquier parte del código:

```typescript
import { sendPushNotification } from "@/lib/pushNotifications";

// Ejemplo: Al asignar orden a conductor
await sendPushNotification({
  userId: driverId,
  title: "Nueva orden asignada",
  body: `Recoger en ${pharmacyName}`,
  data: { orderId, type: "ORDER_ASSIGNED" }
});
```

---

## 📊 Casos de Uso Sugeridos

### Para Conductores

```typescript
// 1. Nueva orden asignada
await sendPushNotification({
  userId: driverId,
  title: "Nueva orden asignada",
  body: `Recoger en ${pharmacyName}`,
  data: { orderId, type: "ORDER_ASSIGNED" }
});

// 2. Orden cancelada
await sendPushNotification({
  userId: driverId,
  title: "Orden cancelada",
  body: `Orden #${orderId} fue cancelada`,
  data: { orderId, type: "ORDER_CANCELLED" }
});
```

### Para Empleados/Farmacias

```typescript
// 1. Alerta de bombas críticas
await sendPushNotification({
  userId: employeeId,
  title: "⚠️ Bombas críticas",
  body: `${count} bombas llevan más de 30 días fuera`,
  data: { type: "PUMP_ALERT_30" }
});

// 2. Devolución pendiente
await sendPushNotification({
  userId: employeeId,
  title: "Devolución pendiente",
  body: `Conductor devolvió ${count} bombas`,
  data: { orderId, type: "RETURN_PENDING" }
});
```

---

## 🧪 Testing

### 1. Probar Registro de Token

```bash
# Abrir consola del navegador
# Ir a cualquier dashboard
# Verificar en Firestore: notification_tokens/{userId}
```

### 2. Probar Envío de Notificación

```bash
# Desde consola del navegador:
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'DRIVER_ID_AQUI',
    title: 'Test',
    body: 'Notificación de prueba'
  })
});
```

---

## ⚠️ Importante

- **NO modifica código existente**
- **Completamente opcional** - La app funciona sin esto
- **Gratis** - FCM es gratuito ilimitado
- **Fácil de remover** - Solo borrar archivos creados

---

## 📝 Próximos Pasos (Opcionales)

1. Agregar `NotificationBell` a dashboards
2. Implementar triggers automáticos
3. Crear cron jobs para alertas diarias
4. Agregar preferencias de usuario

---

## 🔗 Recursos

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications](https://web.dev/push-notifications-overview/)
