import admin from 'firebase-admin';

// Ensure you have these environment variables set in a .env.local file
// FIREBASE_PROJECT_ID
// FIREBASE_CLIENT_EMAIL
// FIREBASE_PRIVATE_KEY

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.warn("⚠️ Firebase Admin environment variables are missing. API routes will fail.");
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

if (admin.apps.length) {
  adminAuth = admin.auth();
  adminDb = admin.firestore();
}

export { adminAuth, adminDb };