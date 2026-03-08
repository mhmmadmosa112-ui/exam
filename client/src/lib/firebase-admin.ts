import admin from 'firebase-admin';

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // تنظيف المفتاح من أي رموز زائدة قد تسبب خطأ Invalid PEM
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("✅ [Server] Firebase Admin initialized successfully");
    } else {
      console.warn("⚠️ [Server] Firebase Admin variables are missing in .env.local");
    }
  }

  if (admin.apps.length > 0) {
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  }
} catch (error: any) {
  console.error('❌ [Server] Firebase admin initialization error:', error.message);
}

export { adminAuth, adminDb };