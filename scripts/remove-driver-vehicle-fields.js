#!/usr/bin/env node
/**
 * Script: remove-driver-vehicle-fields.js
 *
 * Removes legacy fields from driver documents:
 * - plate
 * - vehiclePhotoBase64
 *
 * Usage examples:
 *   node scripts/remove-driver-vehicle-fields.js --serviceAccount=./service-account.json --dryRun
 *   node scripts/remove-driver-vehicle-fields.js --serviceAccount=./service-account.json
 *   node scripts/remove-driver-vehicle-fields.js --serviceAccount=./service-account.json --driverId=DRIVER_DOC_ID
 *
 * Optional flags:
 *   --dryRun          Preview changes without writing
 *   --limit=500       Max docs to scan (default: all)
 *   --batch=300       Batch size for scanning/writes (default: 300)
 */

const admin = require("firebase-admin");

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      const key = raw.slice(2);
      out[key] = true;
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
const { FieldValue, FieldPath } = admin.firestore;

async function processSingleDriver(driverId, dryRun) {
  const ref = db.collection("drivers").doc(driverId);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log(`Driver not found: ${driverId}`);
    return { scanned: 1, updated: 0 };
  }

  const data = snap.data() || {};
  const hasPlate = Object.prototype.hasOwnProperty.call(data, "plate");
  const hasVehiclePhoto = Object.prototype.hasOwnProperty.call(data, "vehiclePhotoBase64");

  if (!hasPlate && !hasVehiclePhoto) {
    console.log(`No legacy fields to remove for driver: ${driverId}`);
    return { scanned: 1, updated: 0 };
  }

  const payload = {};
  if (hasPlate) payload.plate = FieldValue.delete();
  if (hasVehiclePhoto) payload.vehiclePhotoBase64 = FieldValue.delete();

  if (dryRun) {
    console.log(`[DRY RUN] Would update driver ${driverId}:`, Object.keys(payload));
  } else {
    await ref.update(payload);
    console.log(`Updated driver ${driverId}:`, Object.keys(payload));
  }

  return { scanned: 1, updated: 1 };
}

async function run() {
  const dryRun = Boolean(argv.dryRun);
  const driverId = argv.driverId ? String(argv.driverId) : "";
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

  console.log("Starting legacy driver fields cleanup", {
    dryRun,
    driverId: driverId || null,
    limit: limit ?? null,
    batchSize,
  });

  if (driverId) {
    const single = await processSingleDriver(driverId, dryRun);
    console.log("Done", single);
    process.exit(0);
  }

  let scanned = 0;
  let updated = 0;
  let lastDoc = null;

  while (true) {
    const remaining = limit !== undefined ? limit - scanned : batchSize;
    if (limit !== undefined && remaining <= 0) break;

    const pageSize = Math.min(batchSize, limit !== undefined ? remaining : batchSize);

    let q = db.collection("drivers").orderBy(FieldPath.documentId()).limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc.id);

    const snap = await q.get();
    if (snap.empty) break;

    let batch = null;
    if (!dryRun) batch = db.batch();

    let pageUpdates = 0;

    for (const d of snap.docs) {
      const data = d.data() || {};
      const hasPlate = Object.prototype.hasOwnProperty.call(data, "plate");
      const hasVehiclePhoto = Object.prototype.hasOwnProperty.call(data, "vehiclePhotoBase64");

      if (!hasPlate && !hasVehiclePhoto) {
        scanned += 1;
        continue;
      }

      const payload = {};
      if (hasPlate) payload.plate = FieldValue.delete();
      if (hasVehiclePhoto) payload.vehiclePhotoBase64 = FieldValue.delete();

      if (dryRun) {
        console.log(`[DRY RUN] Would update ${d.id}:`, Object.keys(payload));
      } else {
        batch.update(d.ref, payload);
      }

      scanned += 1;
      updated += 1;
      pageUpdates += 1;
    }

    // Count scanned docs that had no legacy fields plus the ones with changes.
    if (snap.size > pageUpdates) {
      // already counted no-change docs above.
    }

    // In case all docs in the page had changes, ensure scanned includes full page.
    // (No-op for mixed pages because scanned was incremented in both branches.)
    if (pageUpdates === snap.size) {
      // scanned already incremented for each changed doc.
    }

    if (!dryRun && pageUpdates > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];

    console.log("Processed page", {
      pageScanned: snap.size,
      pageUpdated: pageUpdates,
      totalScanned: scanned,
      totalUpdated: updated,
    });

    if (snap.size < pageSize) break;
  }

  console.log("Cleanup finished", { scanned, updated, dryRun });
  process.exit(0);
}

run().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
