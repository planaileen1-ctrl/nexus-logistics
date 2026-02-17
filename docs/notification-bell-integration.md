# 🔔 Guía de Integración: NotificationBell

## Cómo Agregar el Componente (Opcional)

El componente `NotificationBell` está listo pero **NO es obligatorio**.
La app funciona perfectamente sin él.

---

## Opción 1: Agregar a Driver Dashboard

**Archivo:** `app/driver/dashboard/page.tsx`

**Paso 1:** Importar el componente (línea ~32, después de otros imports)

```typescript
import NotificationBell from "@/components/NotificationBell";
```

**Paso 2:** Agregar en el header (buscar donde dice "Driver Dashboard", línea ~1050)

```typescript
<div className="text-center space-y-2">
  <div className="flex items-center justify-center gap-4">
    <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
      Driver Dashboard
    </h1>
    {driverId && (
      <NotificationBell 
        userId={driverId} 
        role="DRIVER" 
      />
    )}
  </div>
  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold">
    {driverName || "Driver"}
  </p>
</div>
```

---

## Opción 2: Agregar a Employee Dashboard

**Archivo:** `app/employee/dashboard/page.tsx`

**Paso 1:** Importar (después de los imports existentes)

```typescript
import NotificationBell from "@/components/NotificationBell";
```

**Paso 2:** Agregar en el header del aside (buscar "NEXUS LOGISTICS SYSTEMS")

```typescript
<div className="flex items-center gap-3 px-1">
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
    <LayoutDashboard size={20} className="text-white" />
  </div>
  <div className="flex-1">
    <p className="text-xl font-black text-white leading-none">NEXUS</p>
    <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">LOGISTICS SYSTEMS</p>
  </div>
  {employeeId && pharmacyId && (
    <NotificationBell 
      userId={employeeId} 
      role="EMPLOYEE"
      pharmacyId={pharmacyId}
    />
  )}
</div>
```

**Paso 3:** Obtener employeeId y pharmacyId (agregar al inicio del componente)

```typescript
const employeeId = typeof window !== "undefined" 
  ? localStorage.getItem("EMPLOYEE_ID") 
  : null;

const pharmacyId = typeof window !== "undefined"
  ? localStorage.getItem("PHARMACY_ID")
  : null;
```

---

## Opción 3: Agregar a Pharmacy Dashboard

**Archivo:** `app/pharmacy/dashboard/page.tsx`

**Paso 1:** Importar

```typescript
import NotificationBell from "@/components/NotificationBell";
```

**Paso 2:** Similar a Employee Dashboard, agregar en el aside

```typescript
{pharmacyId && (
  <NotificationBell 
    userId={pharmacyId} 
    role="PHARMACY_ADMIN"
    pharmacyId={pharmacyId}
  />
)}
```

---

## ⚠️ Importante

- **NO es obligatorio** agregar el componente
- La app funciona perfectamente sin él
- Solo agrégalo si quieres la UI de notificaciones
- Las notificaciones funcionan en background sin el componente

---

## 🧪 Testing

1. Abre el dashboard donde agregaste el componente
2. Click en el icono de campana
3. Acepta permisos de notificaciones
4. Verifica en Firestore: `notification_tokens/{userId}`

---

## 📝 Notas

- El componente es completamente nuevo
- No modifica funcionalidad existente
- Fácil de remover si no te gusta
- Puedes personalizarlo como quieras
