'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// قاموس الترجمات
const translations: Record<string, Record<string, string>> = {
  ar: {
    title: 'نظام الامتحانات الذكي',
    subtitle: 'سجّل الدخول لبدء امتحانك',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    loginEmail: 'تسجيل الدخول بالبريد',
    loginGoogle: 'تسجيل الدخول بـ Google',
    loginFacebook: 'تسجيل الدخول بـ Facebook',
    noAccount: 'ليس لديك حساب؟',
    createAccount: 'أنشئ حساباً جديداً',
    or: 'أو',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    dashboard: 'لوحة التحكم',
    exam: 'الامتحان',
    history: 'سجل الامتحانات',
    admin: 'لوحة الأدمن',
    logout: 'تسجيل الخروج',
    startExam: 'ابدأ الامتحان',
    submit: 'تسليم',
    next: 'التالي',
    previous: 'السابق',
    question: 'السؤال',
    of: 'من',
    score: 'الدرجة',
    timeRemaining: 'الوقت المتبقي',
  },
  en: {
    title: 'Smart Exam System',
    subtitle: 'Sign in to start your exam',
    email: 'Email',
    password: 'Password',
    loginEmail: 'Login with Email',
    loginGoogle: 'Login with Google',
    loginFacebook: 'Login with Facebook',
    noAccount: "Don't have an account?",
    createAccount: 'Create new account',
    or: 'Or',
    loading: 'Loading...',
    error: 'Error',
    dashboard: 'Dashboard',
    exam: 'Exam',
    history: 'Exam History',
    admin: 'Admin Panel',
    logout: 'Logout',
    startExam: 'Start Exam',
    submit: 'Submit',
    next: 'Next',
    previous: 'Previous',
    question: 'Question',
    of: 'of',
    score: 'Score',
    timeRemaining: 'Time Remaining',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ar');
  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr'; 

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    // حفظ الاختيار في localStorage
    localStorage.setItem('preferred-language', language);
  }, [language, dir]);

  // استرجاع اللغة المحفوظة عند التحميل
  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as Language;
    if (saved && (saved === 'ar' || saved === 'en')) {
      setLanguage(saved);
    }
  }, []);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};