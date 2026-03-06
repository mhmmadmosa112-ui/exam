'use client';

import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { LogOut, Globe, Home, BookOpen, BarChart3, Settings } from 'lucide-react';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const [user] = useAuthState(auth);
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* الشعار والعنوان */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
              {language === 'ar' ? 'نظام الامتحانات الذكي' : 'Smart Exam System'}
            </h1>
          </div>

          {/* الأزرار */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* زر تبديل اللغة */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md"
              title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              <Globe className="w-4 h-4" />
              <span className="font-bold text-sm hidden sm:inline">
                {language === 'ar' ? '🇬 EN' : '🇸🇦 AR'}
              </span>
            </button>

            {/* زر الصفحة الرئيسية */}
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              title={language === 'ar' ? 'الرئيسية' : 'Home'}
            >
              <Home className="w-5 h-5" />
            </button>

            {/* زر سجل الامتحانات */}
            <button
              onClick={() => router.push('/history')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hidden sm:block"
              title={language === 'ar' ? 'سجل الامتحانات' : 'Exam History'}
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* زر الأدمن (إذا كان أدمن) */}
            {user?.email === 'mhmmad.mosa112@gmail.com' && (
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hidden sm:block"
                title={language === 'ar' ? 'لوحة الأدمن' : 'Admin Panel'}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
{/* زر إدارة المواد */}
<button
  onClick={() => router.push('/admin/subjects')}
  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hidden lg:block"
  title={language === 'ar' ? 'إدارة المواد' : 'Manage Subjects'}
>
  <BookOpen className="w-5 h-5" />
</button>
            {/* زر تسجيل الخروج */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              title={language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {language === 'ar' ? 'خروج' : 'Logout'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}