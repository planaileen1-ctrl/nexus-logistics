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

import { db } from "@/lib/firebase";
import { ensureAnonymousAuth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// 🔢 Generate 4-digit PIN
function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 🏥 Find pharmacy by 4-digit PIN
export async function findPharmacyByPin(pin: string) {
  await ensureAnonymousAuth();

  const q = query(
    collection(db, "pharmacies"),
    where("pin", "==", pin),
    where("active", "==", true)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const pharmacyDoc = snapshot.docs[0];

  return {
    id: pharmacyDoc.id,
    ...pharmacyDoc.data(),
  } as {
    id: string;
    pharmacyName: string;
    country: string;
    state: string;
    city: string;
  };
}

// 👤 Register employee (WITH JOB TITLE)
export async function registerEmployee(
  fullName: string,
  email: string,
  pharmacy: {
    id: string;
    pharmacyName: string;
    country: string;
    state: string;
    city: string;
  },
  jobTitle: string // ✅ NEW PARAMETER
) {
  await ensureAnonymousAuth();

  const pin = generatePin();

  const ref = await addDoc(collection(db, "employees"), {
    fullName,
    email,
    jobTitle, // ✅ SAVED

    pin, // LOGIN PIN
    role: "EMPLOYEE",

    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.pharmacyName,

    country: pharmacy.country,
    state: pharmacy.state,
    city: pharmacy.city,

    active: true,
    createdAt: serverTimestamp(), // DATE + TIME (USA standard UTC)
  });

  return {
    employeeId: ref.id,
    pin,
  };
}
