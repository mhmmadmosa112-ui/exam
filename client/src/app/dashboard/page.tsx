'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, signOut } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { BookOpen, LogOut, User, Clock, Award } from 'lucide-react';

// ✅ Interface مبسط للامتحان (للعرض فقط)
interface Exam {
  _id: string;
  title: { ar: string; en: string };
  subjectId: string;
  settings: {
    duration: number;
    totalPoints: number;
    startDate?: string;  // ✅ أضفنا هذا
    endDate?: string;    // ✅ أضفنا هذا
  };
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  questions?: any[];
}

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [examStarted, setExamStarted] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);  // ✅ أضفنا حالة للامتحانات
  const [loadingExams, setLoadingExams] = useState(true);

  // التوجيه إذا لم يكن مسجلاً
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // ✅ جلب الامتحانات المتاحة للطالب
  useEffect(() => {
    const fetchExams = async () => {
      if (!user?.email) return;
      
      try {
        setLoadingExams(true);
        const res = await fetch('http://localhost:3001/api/exams', {
          headers: { 'x-user-email': user.email }
        });
        const result = await res.json();
        if (result.success) {
          // فلتر الامتحانات المتاحة فقط
          const available = result.data.filter((exam: Exam) => {
            const now = new Date();
            const start = exam.settings?.startDate ? new Date(exam.settings.startDate) : null;
            const end = exam.settings?.endDate ? new Date(exam.settings.endDate) : null;
            
            if (start && now < start) return false;  // لم يبدأ بعد
            if (end && now > end) return false;      // انتهى
            return exam.status === 'published' || exam.status === 'active';
          });
          setExams(available);
        }
      } catch (err) {
        console.error('Error fetching exams:', err);
      } finally {
        setLoadingExams(false);
      }
    };
    
    fetchExams();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleStartExam = (examId: string) => {
    setExamStarted(true);
    router.push(`/exam?id=${examId}`);  // ✅ نرسل ID الامتحان
  };

  if (loading || loadingExams) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-800">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* الشريط العلوي */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.displayName || 'طالب'}</h2>
              <p className="text-sm text-gray-700">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* زر سجل الامتحانات */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/history')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span>سجل الامتحانات</span>
          </button>
        </div>

        {/* قائمة الامتحانات المتاحة */}
        <div className="space-y-4">
          {exams.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <p className="text-gray-800 text-lg">
                لا توجد امتحانات متاحة حالياً
              </p>
            </div>
          ) : (
            exams.map((exam) => (
              <div key={exam._id} className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {exam.title.ar || exam.title.en}
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      {exam.questions?.length || 0} أسئلة • {exam.settings?.totalPoints || 0} درجة
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    exam.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {exam.status === 'active' ? 'نشط الآن' : 'مجدول'}
                  </span>
                </div>
                
                {/* معلومات الامتحان */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4" />
                    <span>{exam.settings?.duration || 30} دقيقة</span>
                  </div>
                </div>

                {/* زر البدء */}
                <button
                  onClick={() => handleStartExam(exam._id)}
                  disabled={examStarted}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-xl transition-all"
                >
                  {examStarted ? 'جاري التحميل...' : '🚀 ابدأ الامتحان'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}