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

/**
 * Save employee signature to Firestore
 * Collection: signatures
 */
export async function saveEmployeeSignature({
  employeeId,
  employeeName,
  pharmacyId,
  signatureBase64,
}: {
  employeeId: string;
  employeeName: string;
  pharmacyId: string;
  signatureBase64: string;
}) {
  await ensureAnonymousAuth();

  if (!signatureBase64) {
    throw new Error("Signature is empty");
  }

  await addDoc(collection(db, "signatures"), {
    employeeId,
    employeeName,
    pharmacyId,
    signatureBase64, // PNG base64
    createdAt: serverTimestamp(), // USA time (Firestore)
  });
}
