#!/usr/bin/env node
/**
 * Script: fix-premature-maintenance-returns.js
 *
 * Fixes pumps that were incorrectly moved to maintenance before pharmacy intake.
 *
 * A pump will be corrected when:
 * - There is evidence the customer returned it (orders.previousPumpsStatus[].returned === true)
 * - It is NOT yet confirmed at pharmacy (orders.previousPumpsReturnToPharmacy[].returnedToPharmacy !== true)
 * - Pump is currently marked maintenance (status === "IN_MAINTENANCE" or maintenanceDue === true)
 *
 * Update applied:
 * - status: "RETURN_IN_TRANSIT"
 * - maintenanceDue: false
 * - maintenanceDueAt: null
 * - maintenanceUpdatedAt: serverTimestamp
 * - maintenanceCompletedAt: null
 *
 * Usage examples:
 *   node scripts/fix-premature-maintenance-returns.js --dryRun
 *   node scripts/fix-premature-maintenance-returns.js
 *   node scripts/fix-premature-maintenance-returns.js --pharmacyId=YOUR_PHARMACY_ID --dryRun
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

function makeKey(pharmacyId, pumpNumber) {
  return `${String(pharmacyId || "").trim()}::${String(pumpNumber || "").trim()}`;
}

async function collectPendingReturnKeys({ pharmacyIdFilter, pageSize = 300 }) {
  const pendingByKey = new Map();
  let lastDoc = null;

  while (true) {
    let q = db.collection("orders").orderBy(FieldPath.documentId()).limit(pageSize);
    if (pharmacyIdFilter) q = q.where("pharmacyId", "==", pharmacyIdFilter);
    if (lastDoc) q = q.startAfter(lastDoc.id);

    const snap = await q.get();
    if (snap.empty) break;

    for (const d of snap.docs) {
      const order = d.data() || {};
      const pharmacyId = String(order.pharmacyId || "").trim();
      if (!pharmacyId) continue;

      const returned = (order.previousPumpsStatus || [])
        .filter((entry) => entry && entry.returned === true)
        .map((entry) => String(entry.pumpNumber || "").trim())
        .filter(Boolean);

      if (returned.length === 0) continue;

      const returnedToPharmacySet = new Set(
        (order.previousPumpsReturnToPharmacy || [])
          .filter((entry) => entry && entry.returnedToPharmacy === true)
          .map((entry) => String(entry.pumpNumber || "").trim())
          .filter(Boolean)
      );

      for (const pumpNumber of returned) {
        const key = makeKey(pharmacyId, pumpNumber);
        const already = pendingByKey.get(key) || { returned: false, confirmedAtPharmacy: false };

        already.returned = true;
        if (returnedToPharmacySet.has(pumpNumber)) {
          already.confirmedAtPharmacy = true;
        }

        pendingByKey.set(key, already);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  const pendingKeys = new Set();
  pendingByKey.forEach((state, key) => {
    if (state.returned === true && state.confirmedAtPharmacy !== true) {
      pendingKeys.add(key);
    }
  });

  return pendingKeys;
}

async function run() {
  const dryRun = Boolean(argv.dryRun);
  const pharmacyId = argv.pharmacyId ? String(argv.pharmacyId) : "";
  const batchSize = argv.batch ? Number.parseInt(String(argv.batch), 10) : 300;

  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 500) {
    console.error("Invalid --batch value. Use an integer between 1 and 500.");
    process.exit(1);
  }

  console.log("Starting premature maintenance fix", {
    dryRun,
    pharmacyId: pharmacyId || null,
    batchSize,
  });

  const pendingReturnKeys = await collectPendingReturnKeys({
    pharmacyIdFilter: pharmacyId || null,
    pageSize: batchSize,
  });

  console.log("Pending return keys detected", { count: pendingReturnKeys.size });

  let scanned = 0;
  let updated = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection("pumps").orderBy(FieldPath.documentId()).limit(batchSize);
    if (pharmacyId) q = q.where("pharmacyId", "==", pharmacyId);
    if (lastDoc) q = q.startAfter(lastDoc.id);

    const snap = await q.get();
    if (snap.empty) break;

    let pageUpdated = 0;
    let batch = null;
    if (!dryRun) batch = db.batch();

    for (const d of snap.docs) {
      scanned += 1;
      const pump = d.data() || {};
      const key = makeKey(pump.pharmacyId, pump.pumpNumber);
      const needsFix = pendingReturnKeys.has(key);
      const isInMaintenance = pump.status === "IN_MAINTENANCE" || pump.maintenanceDue === true;

      if (!needsFix || !isInMaintenance) continue;

      const payload = {
        status: "RETURN_IN_TRANSIT",
        maintenanceDue: false,
        maintenanceDueAt: null,
        maintenanceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        maintenanceCompletedAt: null,
      };

      if (dryRun) {
        console.log("[DRY RUN] Would fix pump", {
          id: d.id,
          pumpNumber: pump.pumpNumber || null,
          pharmacyId: pump.pharmacyId || null,
          fromStatus: pump.status || null,
          fromMaintenanceDue: pump.maintenanceDue === true,
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

    if (snap.size < batchSize) break;
  }

  console.log("Fix finished", { scanned, updated, dryRun });
  process.exit(0);
}

run().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
