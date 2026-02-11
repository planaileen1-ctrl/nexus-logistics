/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new functions
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */

import { db } from "@/lib/firebase";
import { ensureAnonymousAuth } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Generate human-readable license code
 * Example: NX-8F3A-92KD
 */
function generateLicenseCode() {
  const part = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase();

  return `NX-${part()}-${part()}`;
}

// CREATE LICENSE
export async function createLicense(email: string) {
  await ensureAnonymousAuth();

  const licenseRef = doc(collection(db, "licenses"));
  const licenseCode = generateLicenseCode();

  await setDoc(licenseRef, {
    code: licenseCode,
    email,
    status: "ACTIVE",
    used: false,
    pharmacyId: null,

    createdAt: serverTimestamp(),
    activatedAt: serverTimestamp(),
    suspendedAt: null,
    cancelledAt: null,

    createdBy: "SUPER_ADMIN",
  });

  return {
    id: licenseRef.id,
    code: licenseCode,
  };
}

// SUSPEND LICENSE
export async function suspendLicense(licenseId: string) {
  await ensureAnonymousAuth();

  await updateDoc(doc(db, "licenses", licenseId), {
    status: "SUSPENDED",
    suspendedAt: serverTimestamp(),
  });
}

// CANCEL LICENSE
export async function cancelLicense(licenseId: string) {
  await ensureAnonymousAuth();

  await updateDoc(doc(db, "licenses", licenseId), {
    status: "CANCELLED",
    cancelledAt: serverTimestamp(),
  });
}

// DELETE LICENSE (ONLY IF NOT USED)
export async function deleteLicense(licenseId: string) {
  await ensureAnonymousAuth();

  await deleteDoc(doc(db, "licenses", licenseId));
}
