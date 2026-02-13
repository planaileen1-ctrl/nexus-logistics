#!/usr/bin/env node
/**
 * Script: fix-pumps-maintenance-state.js
 *
 * Reconciles pumps that are fully maintained but still marked in maintenance.
 *
 * A pump will be updated when:
 * - maintenanceStatus.cleaned === true
 * - maintenanceStatus.calibrated === true
 * - maintenanceStatus.inspected === true
 * - and currently status === "IN_MAINTENANCE" OR maintenanceDue === true
 *
 * Update applied:
 * - status: "AVAILABLE"
 * - maintenanceDue: false
 * - maintenanceUpdatedAt: serverTimestamp
 * - maintenanceCompletedAt: serverTimestamp
 *
 * Usage examples:
 *   node scripts/fix-pumps-maintenance-state.js --dryRun
 *   node scripts/fix-pumps-maintenance-state.js
 *   node scripts/fix-pumps-maintenance-state.js --pharmacyId=YOUR_PHARMACY_ID --dryRun
 *
 * Credentials:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS
 *   - or pass --serviceAccount=./service-account.json
 */

const admin = require("firebase-admin");

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw.slice(2)] = true;
      continue;
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    out[key] = value;
  }
  return out;
}

const argv = parseArgs(process.argv.slice(2));
const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || argv.serviceAccount;

if (!svcPath) {
  console.error("ERROR: Set GOOGLE_APPLICATION_CREDENTIALS or pass --serviceAccount=path.json");
  process.exit(1);
}

try {
  const svc = require(svcPath);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
} catch (err) {
  console.error("Failed to initialize Firebase Admin:", err.message || err);
  process.exit(1);
}

const db = admin.firestore();
const { FieldPath } = admin.firestore;

function isFullyMaintained(data) {
  const s = data.maintenanceStatus || {};
  return s.cleaned === true && s.calibrated === true && s.inspected === true;
}

function isMarkedInMaintenance(data) {
  return data.status === "IN_MAINTENANCE" || data.maintenanceDue === true;
}

async function run() {
  const dryRun = Boolean(argv.dryRun);
  const pharmacyId = argv.pharmacyId ? String(argv.pharmacyId) : "";
  const limit = argv.limit ? Number.parseInt(String(argv.limit), 10) : undefined;
  const batchSize = argv.batch ? Number.parseInt(String(argv.batch), 10) : 300;

  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 500) {
    console.error("Invalid --batch value. Use an integer between 1 and 500.");
    process.exit(1);
  }

  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    console.error("Invalid --limit value. Use a positive integer.");
    process.exit(1);
  }

  console.log("Starting pumps maintenance reconciliation", {
    dryRun,
    pharmacyId: pharmacyId || null,
    limit: limit ?? null,
    batchSize,
  });

  let scanned = 0;
  let updated = 0;
  let lastDoc = null;

  while (true) {
    const remaining = limit !== undefined ? limit - scanned : batchSize;
    if (limit !== undefined && remaining <= 0) break;

    const pageSize = Math.min(batchSize, limit !== undefined ? remaining : batchSize);

    let q = db.collection("pumps").orderBy(FieldPath.documentId()).limit(pageSize);
    if (pharmacyId) q = q.where("pharmacyId", "==", pharmacyId);
    if (lastDoc) q = q.startAfter(lastDoc.id);

    const snap = await q.get();
    if (snap.empty) break;

    let pageUpdated = 0;
    let batch = null;
    if (!dryRun) batch = db.batch();

    for (const d of snap.docs) {
      scanned += 1;
      const data = d.data() || {};

      if (!isFullyMaintained(data)) continue;
      if (!isMarkedInMaintenance(data)) continue;

      const payload = {
        status: "AVAILABLE",
        maintenanceDue: false,
        maintenanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        maintenanceCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (dryRun) {
        console.log("[DRY RUN] Would update pump", {
          id: d.id,
          pumpNumber: data.pumpNumber || null,
          pharmacyId: data.pharmacyId || null,
          beforeStatus: data.status || null,
          beforeMaintenanceDue: data.maintenanceDue === true,
        });
      } else {
        batch.update(d.ref, payload);
      }

      pageUpdated += 1;
      updated += 1;
    }

    if (!dryRun && pageUpdated > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];

    console.log("Processed page", {
      pageScanned: snap.size,
      pageUpdated,
      totalScanned: scanned,
      totalUpdated: updated,
    });

    if (snap.size < pageSize) break;
  }

  console.log("Reconciliation finished", { scanned, updated, dryRun });
  process.exit(0);
}

run().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
