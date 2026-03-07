'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { BookOpen, Clock, Award, ArrowLeft, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Header from '@/components/Header';

interface ExamHistory {
  _id: string;
  userId: string;
  examTopic: string;
  score: number;
  duration: number;
  timeSpent: number;
  submittedAt: string;
  isReviewed: boolean;
  // For detailed view
  questions?: any[];
  answers?: (number | string)[];
  essayAnswers?: string[];
}

interface DetailedExamResult extends ExamHistory {
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; modelAnswer?: {ar: string; en: string}; type: string; }>;
  answers: (number | string)[];
  essayAnswers?: string[];
}

export default function HistoryPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  
  const [history, setHistory] = useState<ExamHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [selectedExam, setSelectedExam] = useState<DetailedExamResult | null>(null);

  // التوجيه إذا لم يكن مسجل الدخول
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const viewResultDetails = async (examResult: ExamHistory) => {
    if (!user?.email) return;
    try {
      setLoadingHistory(true);
      const response = await fetch(`http://localhost:3001/api/student-exams/result/${examResult._id}`, {
        headers: { 'x-user-email': user.email }
      });
      const data = await response.json();
      if (data.success) {
        if (data.data.isReviewed && data.data.questions) {
          setSelectedExam(data.data);
        } else {
          alert('Results are not published or details are unavailable.');
        }
      } else {
        setError(data.error || 'Failed to fetch details');
      }
    } catch (err) {
      setError('Failed to fetch details');
    } finally {
      setLoadingHistory(false);
    }
  };
  // جلب سجل الامتحانات
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid) return;
      
      try {
        setLoadingHistory(true);
        setError(''); 
        
        const response = await fetch(`http://localhost:3001/api/exam/history/${user.uid}`);
        const result = await response.json();
        
        if (result.success) {
          setHistory(result.data.results);
        } else {
          setError(result.error || 'فشل جلب السجل');
        }
      } catch (err: any) {
        setError('حدث خطأ في الاتصال بالسيرفر');
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user]);

  // تنسيق التاريخ
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // تنسيق الوقت
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}د ${secs}ث`;
  };

  // لون الدرجة
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // شاشة التحميل
  if (loading || loadingHistory) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">جاري تحميل السجل...</p>
        </div>
      </div>
    );
  }

  // عرض تفاصيل امتحان محدد
  if (selectedExam) {
    return (
        <>
    <Header />  {/* ← أضف هذا */}
    
      <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4" dir="rtl">
        <div className="max-w-3xl mx-auto">
          {/* زر الرجوع */}
          <button
            onClick={() => setSelectedExam(null)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>العودة للسجل</span>
          </button>

          {/* بطاقة التفاصيل */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6 pb-6 border-b">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedExam.examTopic}</h1>
                <p className="text-gray-600">{formatDate(selectedExam.submittedAt)}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl font-bold ${getScoreColor(selectedExam.score)}`}>
                {selectedExam.score}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">المدة المحددة</p>
                  <p className="font-bold text-gray-900">{selectedExam.duration} دقيقة</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <Award className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">الوقت المستغرق</p>
                  <p className="font-bold text-gray-900">{formatDuration(selectedExam.timeSpent)}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">حالة المراجعة:</p>
              <p className={`font-medium ${selectedExam.isReviewed ? 'text-green-600' : 'text-gray-500'}`}>
                {selectedExam.isReviewed ? '✅ تمت المراجعة' : '⏳ في انتظار المراجعة'}
              </p>
            </div>

            <div className="mt-8 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-700">
                💡 <strong>ملاحظة:</strong> تفاصيل الأسئلة والإجابات ستكون متاحة قريباً في نسخة المراجعة المتقدمة.
              </p>
            </div>

            {/* Detailed Questions Review */}
            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-bold text-gray-800">مراجعة الإجابات</h2>
              {selectedExam.questions?.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-xl p-6 shadow-sm border">
                  <p className="font-bold text-lg mb-4">{idx + 1}. {q.question}</p>
                  
                  {q.type === 'essay' || q.type === 'fill-blank' ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-sm font-bold text-blue-800">إجابتك</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{selectedExam.essayAnswers?.[idx] || 'لم تتم الإجابة'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-sm font-bold text-green-800">الإجابة النموذجية</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{q.modelAnswer?.ar || 'غير متوفرة'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {q.options?.map((opt: string, optIdx: number) => (
                        <div key={optIdx} className={`p-3 rounded-lg border flex items-center gap-3 ${
                          optIdx === q.correctAnswer ? 'border-green-500 bg-green-50' :
                          optIdx === selectedExam.answers?.[idx] ? 'border-red-500 bg-red-50' : 'border-gray-200'
                        }`}>
                          {optIdx === q.correctAnswer 
                            ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                            : (optIdx === selectedExam.answers?.[idx] 
                                ? <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                                : <div className="w-5 h-5 shrink-0" />)
                          }
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>
  </>
    );
  }

  // عرض قائمة السجل
  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* الشريط العلوي */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">سجل امتحاناتي</h1>
              <p className="text-sm text-gray-600">{user?.displayName}</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            + امتحان جديد
          </button>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* قائمة الامتحانات */}
        {history.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">لا توجد امتحانات بعد</h2>
            <p className="text-gray-600 mb-6">ابدأ أول امتحان لك لتظهر النتائج هنا</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
            >
              🚀 ابدأ امتحاناً الآن
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((exam) => (
              <div
                key={exam._id}
                onClick={() => exam.isReviewed ? viewResultDetails(exam) : alert('النتائج التفصيلية غير متاحة بعد.')}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{exam.examTopic}</h3>
                    <p className="text-sm text-gray-600">{formatDate(exam.submittedAt)}</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-sm text-gray-600">الدرجة</p>
                      <p className={`text-xl font-bold ${getScoreColor(exam.score).split(' ')[0]}`}>
                        {exam.score}%
                      </p>
                    </div>
                    
                    <button className={`p-2 rounded-lg transition-colors ${exam.isReviewed ? 'hover:bg-gray-100' : 'cursor-not-allowed opacity-50'}`}
                      disabled={!exam.isReviewed}
                    >
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t flex items-center gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {exam.duration} دقيقة
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    exam.isReviewed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {exam.isReviewed ? '✓ مراجع' : 'في الانتظار'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}