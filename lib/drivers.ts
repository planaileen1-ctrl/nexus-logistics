/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new fields
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 🚗 Register Driver (FULL)
export async function registerDriver({
  fullName,
  email,
  country,
  state,
  city,
  plateNumber,
  vehiclePhotoBase64,
}: {
  fullName: string;
  email: string;
  country: string;
  state: string;
  city: string;
  plateNumber: string;
  vehiclePhotoBase64: string;
}) {
  await ensureAnonymousAuth();

  const pin = generatePin();

  const ref = await addDoc(collection(db, "drivers"), {
    fullName,
    email,
    country,
    state,
    city,
    plateNumber,
    vehiclePhotoBase64,
    pin,
    active: true,
    createdAt: serverTimestamp(), // USA
  });

  return {
    driverId: ref.id,
    pin,
  };
}
