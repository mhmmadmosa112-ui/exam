import admin from 'firebase-admin';

// Ensure you have these environment variables set in a .env.local file
// FIREBASE_PROJECT_ID
// FIREBASE_CLIENT_EMAIL
// FIREBASE_PRIVATE_KEY

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log("✅ [Server] Firebase Admin initialized successfully");
    } else {
      console.warn("⚠️ [Server] Firebase Admin environment variables are missing in .env.local");
    }
  }

  if (admin.apps.length > 0) {
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  }
} catch (error: any) {
  console.error('❌ [Server] Firebase admin initialization error:', error);
}

export { adminAuth, adminDb };