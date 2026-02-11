import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export async function logPumpMovement({
  pumpId,
  pumpNumber,
  pharmacyId,
  orderId,
  action,
  performedById,
  performedByName,
  role,
}: {
  pumpId: string
  pumpNumber: string
  pharmacyId: string
  orderId?: string
  action: "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "RETURNED"
  performedById: string
  performedByName: string
  role: "EMPLOYEE" | "DRIVER"
}) {
  await addDoc(collection(db, "pump_movements"), {
    pumpId,
    pumpNumber,
    pharmacyId,
    orderId: orderId || null,
    action,
    performedById,
    performedByName,
    role,
    timestamp: serverTimestamp(),
  })
}
