#!/usr/bin/env node
/**
 * Script: migrate-created-to-pending.js
 * Usage:
 *   - Set env var GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path
 *   - node scripts/migrate-created-to-pending.js --limit=100 --pharmacyId=PHARMACY_ID
 *
 * This will find orders with status 'CREATED' and update them to 'PENDING' in batches.
 */

const admin = require("firebase-admin");
const argv = require("minimist")(process.argv.slice(2));

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

async function migrateBatch({ limit, pharmacyId }) {
  let q = db.collection('orders').where('status', '==', 'CREATED');
  if (pharmacyId) q = q.where('pharmacyId', '==', pharmacyId);
  if (limit) q = q.limit(limit);

  const snap = await q.get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: 'PENDING' });
  });

  await batch.commit();
  return snap.size;
}

async function run() {
  const limit = argv.limit ? parseInt(argv.limit, 10) : undefined;
  const pharmacyId = argv.pharmacyId || argv.pharmacy || undefined;
  console.log('Starting migration', { limit, pharmacyId });

  let total = 0;
  // If a limit is provided, run once. Otherwise loop until none left.
  if (limit) {
    const updated = await migrateBatch({ limit, pharmacyId });
    total += updated;
  } else {
    while (true) {
      const updated = await migrateBatch({ limit: 500, pharmacyId });
      if (updated === 0) break;
      total += updated;
      console.log('Updated batch:', updated, 'total:', total);
      // small delay to avoid bursts
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log('Migration finished. Total orders updated:', total);
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
