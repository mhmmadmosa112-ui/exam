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

  if (admin.apps.length > 0 && !adminAuth) {
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  }
} catch (error: any) {
  console.error('❌ [Server] Firebase admin initialization error:', error);
  // إذا كان الخطأ بسبب المكتبة المفقودة، نوضح الحل للمستخدم
  if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
    console.error('👉 الحل: قم بتشغيل الأمر التالي في التيرمينال: npm install @opentelemetry/api');
  }
}

export { adminAuth, adminDb };