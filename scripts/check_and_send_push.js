#!/usr/bin/env node
// Usage: node scripts/check_and_send_push.js DRIVER_ID "Test title" "Test body"

const admin = require('firebase-admin');
const fs = require('fs');

function loadEnv() {
  const p = '.env.local';
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val.replace(/\\n/g, '\n');
    }
  }
}

async function main() {
  loadEnv();
  const driverIdArg = process.argv[2];
  if (!driverIdArg) {
    console.error('Usage: node scripts/check_and_send_push.js DRIVER_ID [TITLE] [BODY]');
    process.exit(2);
  }
  const title = process.argv[3] || 'Test Notification';
  const body = process.argv[4] || 'This is a test push from scripts/check_and_send_push.js';

  // Normalize driverId: accept full path like /drivers/ID or plain ID
  const driverId = driverIdArg.includes('/') ? driverIdArg.split('/').filter(Boolean).pop() : driverIdArg;

  // Init admin
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase admin env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
      process.exit(3);
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err) {
    console.error('Failed to initialize firebase-admin:', err);
    process.exit(4);
  }

  const db = admin.firestore();

  try {
    const doc = await db.collection('notification_tokens').doc(driverId).get();
    if (!doc.exists) {
      console.log(`No token document found for driverId=${driverId}`);
      process.exit(0);
    }

    const data = doc.data() || {};
    console.log('Token document data:', data);

    const token = data.token;
    if (!token) {
      console.log('No token field in document.');
      process.exit(0);
    }

    console.log('Sending test message to token (masked): •••' + token.slice(-6));

    const message = {
      token,
      notification: {
        title,
        body,
      },
      data: { source: 'script-test' },
    };

    const res = await admin.messaging().send(message);
    console.log('Send result:', res);
  } catch (err) {
    console.error('Error checking/sending push:', err);
    process.exit(5);
  }
}

main();
