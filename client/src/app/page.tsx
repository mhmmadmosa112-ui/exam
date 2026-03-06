'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  auth, 
  googleProvider, 
  signInWithPopup,
  facebookProvider 
} from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { BookOpen, LogIn } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';

export default function HomePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  const { language, toggleLanguage, dir, t } = useLanguage();

  // ✅ useEffect الأول: التوجيه عند تسجيل الدخول
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // ✅ useEffect الثاني: تطبيق اللغة والاتجاه (أضفه هنا)
  useEffect(() => {
    console.log('🌐 Language changed:', language, 'Direction:', dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);
  

  // تسجيل الدخول بـ Google
  const handleGoogleLogin = async () => {
    try {
      setLoginLoading(true);
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول بـ Google');
    } finally {
      setLoginLoading(false);
    }
  };

  // تسجيل الدخول بـ Facebook
const handleFacebookLogin = async () => {
  try {
    setLoginLoading(true);
    setError('');
    // ✅ نستخدم facebookProvider المُصدَّر مباشرة
    await signInWithPopup(auth, facebookProvider);
  } catch (err: any) {
    setError(err.message || 'فشل تسجيل الدخول بـ Facebook');
  } finally {
    setLoginLoading(false);
  }
};

  // تسجيل الدخول بالبريد
  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      setError('يرجى ملء جميع الحقول');
      return;
    }
    
    try {
      setLoginLoading(true);
      setError('');
      await signInWithEmailAndPassword(auth, email, password);
      // سيتم التوجيه تلقائياً عبر useEffect
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('لا يوجد حساب بهذا البريد الإلكتروني');
      } else if (err.code === 'auth/wrong-password') {
        setError('كلمة المرور غير صحيحة');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح');
      } else if (err.code === 'auth/user-disabled') {
        setError('تم تعطيل هذا الحساب');
      } else {
        setError(err.message || 'فشل تسجيل الدخول');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // إنشاء حساب جديد
  const handleSignUp = async () => {
    const email = prompt('أدخل بريدك الإلكتروني:');
    const password = prompt('أدخل كلمة المرور (6 أحرف على الأقل):');
    
    if (!email || !password) return;
    
    try {
      setLoginLoading(true);
      setError('');
      await createUserWithEmailAndPassword(auth, email, password);
      // سيتم التوجيه تلقائياً
    } catch (err: any) {
      console.error('SignUp error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا البريد مسجل مسبقاً');
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح');
      } else {
        setError(err.message || 'فشل إنشاء الحساب');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // شاشة التحميل
if (loading) {
  return (
    <>
      <Header />
    
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
          </>  // ← أضف هذا الإغلاق

    );
  }
// تحقق من أن LanguageContext يعمل
if (typeof dir === 'undefined') {
  console.error('❌ LanguageContext not working - dir is undefined');
}
  return (

    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={dir}>
      {/* زر تبديل اللغة */}
{/* زر تبديل اللغة - نسخة مضمونة للظهور */}
<div className="fixed top-4 left-4 z-[9999]">
  <button
    onClick={toggleLanguage}
    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg border-2 border-white transition-all transform hover:scale-105"
    title="تبديل اللغة"
  >
    {language === 'ar' ? '🇬🇧 EN' : '🇸🇦 AR'}
  </button>
</div>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* الشعار */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* نموذج تسجيل الدخول بالبريد */}
        <form onSubmit={handleEmailLogin} className="mb-4 space-y-3">
          <input
            type="email"
            name="email"
            placeholder={t('email')}
            required
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="password"
            name="password"
            placeholder={t('password')}
            required
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {t('loginEmail')}
          </button>
        </form>

        {/* زر إنشاء حساب جديد */}
        <p className="text-sm text-gray-600 mt-2">
         {t('noAccount')}
          <button
            type="button"
            onClick={handleSignUp}
            className="text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
           {t('createAccount')}
          </button>
        </p>

        {/* فاصل */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">أو</span>
          </div>
        </div>

        {t('loginGoogle')}
        <button
          onClick={handleGoogleLogin}
          disabled={loginLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <LogIn className="w-5 h-5" />
              <span>تسجيل الدخول بـ Google</span>
            </>
          )}
        </button>

        {t('loginFacebook')}
        <button
          onClick={handleFacebookLogin}
          disabled={loginLoading}
          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 mt-3"
        >
          {loginLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.315 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>تسجيل الدخول بـ Facebook</span>
            </>
          )}
        </button>

        {/* تذييل الصفحة */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            🔐 مدعوم بـ Firebase Auth & Gemini AI
          </p>
        </div>
      </div>
    </main>
);
}