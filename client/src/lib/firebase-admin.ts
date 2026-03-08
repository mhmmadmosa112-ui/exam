import admin from 'firebase-admin';

let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // تنظيف المفتاح بشكل متقدم لتجنب أخطاء PEM
    if (privateKey) {
      // إزالة علامات التنصيص المحيطة إذا كانت موجودة (يحدث عند النسخ من ملفات JSON)
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      // استبدال رموز السطر الجديد النصية بأسطر حقيقية
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        console.log("✅ [Server] Firebase Admin initialized successfully");
      } catch (e) {
        console.error("❌ [Server] Failed to initializeApp:", e);
      }
    } else {
      console.warn("⚠️ [Server] Firebase Admin variables are missing in .env.local");
    }
  }

  if (admin.apps.length > 0) {
    try {
      if (!adminAuth) adminAuth = admin.auth();
    } catch (e) {
      console.error("❌ [Server] Failed to initialize Auth:", e);
    }

    try {
      if (!adminDb) adminDb = admin.firestore();
    } catch (e: any) {
      console.error("❌ [Server] Failed to initialize Firestore:", e);
      if (e.code === 'MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
        console.error('👉 Solution: npm install @opentelemetry/api');
      }
    }
  }
} catch (error: any) {
  console.error('❌ [Server] Firebase admin initialization error:', error);
}

export { adminAuth, adminDb };