'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLanguage } from '@/context/LanguageContext';
import { Clock, ChevronLeft, ChevronRight, CheckCircle, Award, AlertCircle, Loader2 } from 'lucide-react';
import Header from '@/components/Header';

// ✅ Interface للسؤال
interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay';
  text: { ar: string; en: string };
  options?: Array<{ id: string; text: { ar: string; en: string }; isCorrect?: boolean }>;
  correctAnswer?: { ar: string; en: string };
  points: number;
  modelAnswer?: { ar: string; en: string };
  keywords?: string[];
}

// ✅ Interface لإعدادات الامتحان
interface ExamSettings {
  duration: number;
  totalPoints: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: 'immediate' | 'after-publish' | 'never';
  allowReview: boolean;
  allowBackNavigation: boolean;
  timePerQuestion?: boolean;
  timePerQuestionSeconds?: number;
}

// ✅ Interface للامتحان
interface Exam {
  _id: string;
  title: { ar: string; en: string };
  subjectId?: string;
  settings: ExamSettings;
  questions: Question[];
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  isReviewed?: boolean;
}

export default function ExamPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, dir } = useLanguage();
  
  const examId = searchParams.get('id');
  
  const [exam, setExam] = useState<Exam | null>(null);
  
  // ✅ الحالات المصححة: استخدام مصفوفات مرتبة بالفهرس بدلاً من Record
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<(number | undefined)[]>([]);
  const [essayAnswers, setEssayAnswers] = useState<(string | undefined)[]>([]);
  
  // ✅ وقت الامتحان المتقدم
  const [timeRemaining, setTimeRemaining] = useState(1800);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loadingExam, setLoadingExam] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // التوجيه إذا لم يكن مسجلاً
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // ✅ جلب الامتحان من الـ Backend
  useEffect(() => {
    if (!examId || !user?.email) return;
    
    const fetchExam = async () => {
      try {
        setLoadingExam(true);
        setError('');
        
        const res = await fetch(`http://localhost:3001/api/student-exams/${examId}`, {
          method: 'GET',
          headers: { 'x-user-email': user.email!, 'x-user-id': user.uid }
        });
        
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          const text = await res.text();
          console.error('❌ Expected JSON, received:', text.substring(0, 200));
          throw new Error('استجابة غير صالحة من السيرفر');
        }
        
        const data = await res.json();
        
        if (data.success) {
          setExam(data.data);
          // ✅ تهيئة الوقت من إعدادات الامتحان
          const duration = data.data.settings?.duration || 30;
          setTimeRemaining(duration * 60);
          // ✅ تهيئة مصفوفات الإجابات بحجم عدد الأسئلة
          const qCount = data.data.questions?.length || 0;
          setStudentAnswers(new Array(qCount).fill(undefined));
          setEssayAnswers(new Array(qCount).fill(undefined));
        } else {
          if ((data.error || '').toLowerCase().includes('already submitted')) {
            const req = confirm(language === 'ar'
              ? 'لقد قمت بتسليم هذا الامتحان مسبقاً. هل تريد طلب إعادة محاولة؟'
              : 'You already submitted this exam. Request retake?');
            if (req) {
              await fetch('http://localhost:3001/api/student-exams/retake-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-email': user.email!, 'x-user-id': user.uid },
                body: JSON.stringify({ examId, userId: user.uid })
              });
              alert(language === 'ar' ? 'تم إرسال طلب إعادة المحاولة' : 'Retake request sent');
            }
            router.push('/dashboard');
            return;
          }
          setError(data.error || 'فشل جلب الامتحان');
        }
      } catch (err: any) {
        console.error('❌ Fetch error:', err);
        setError('حدث خطأ في الاتصال بالسيرفر');
      } finally {
        setLoadingExam(false);
      }
    };
    
    fetchExam();
  }, [examId, user]);

  // ✅ مراقبة الغش بالخروج من التبويب أو فقدان التركيز
  useEffect(() => {
    if (!exam || !user || !examStarted || examSubmitted) return;
    const handlerVisibility = () => {
      if (document.visibilityState === 'hidden') {
        alert(language === 'ar' ? 'تحذير: غادرت صفحة الامتحان' : 'Warning: You left the exam page');
        fetch('http://localhost:3001/api/student-exams/cheat-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': user.email! },
          body: JSON.stringify({
            examId: exam._id,
            userId: user.uid,
            event: 'visibilitychange',
            details: 'tab hidden'
          })
        }).catch(()=>{});
      }
    };
    const handlerBlur = () => {
      alert(language === 'ar' ? 'تحذير: نافذة الامتحان فقدت التركيز' : 'Warning: Exam window lost focus');
      fetch('http://localhost:3001/api/student-exams/cheat-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email! },
        body: JSON.stringify({
          examId: exam._id,
          userId: user.uid,
          event: 'blur',
          details: 'window blur'
        })
      }).catch(()=>{});
    };
    document.addEventListener('visibilitychange', handlerVisibility);
    window.addEventListener('blur', handlerBlur);
    return () => {
      document.removeEventListener('visibilitychange', handlerVisibility);
      window.removeEventListener('blur', handlerBlur);
    };
  }, [exam, user, language, examStarted, examSubmitted]);

  // ✅ تحذير قبل الإغلاق/التحديث
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (examStarted && !examSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [examStarted, examSubmitted]);

  // ✅ دالة بدء الامتحان ← مهمة جداً لتشغيل العداد
  const startExam = useCallback(() => {
    if (!examStarted && exam) {
      setExamStarted(true);
    }
  }, [examStarted, exam]);

  // ✅ مؤقت الامتحان الرئيسي - مصحح
  useEffect(() => {
    if (examStarted && !examSubmitted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          return newTime >= 0 ? newTime : 0; // ✅ منع القيم السالبة
        });
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining === 0 && examStarted && !examSubmitted) {
      submitExam(); // ✅ تسليم تلقائي عند انتهاء الوقت
    }
  }, [examStarted, examSubmitted, timeRemaining]);

  // ✅ مؤقت لكل سؤال (إذا مفعّل في الإعدادات)
  useEffect(() => {
    if (exam?.settings?.timePerQuestion && examStarted && !examSubmitted) {
      const secondsPerQuestion = exam.settings.timePerQuestionSeconds || 60;
      const questionTimer = setInterval(() => {
        if (currentQuestionIndex < (exam.questions?.length || 0) - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        } else {
          submitExam();
        }
      }, secondsPerQuestion * 1000);
      
      return () => clearInterval(questionTimer);
    }
  }, [currentQuestionIndex, examStarted, examSubmitted, exam]);

  // ✅ اختيار إجابة للأسئلة الموضوعية ← يبدأ الامتحان تلقائياً عند أول إجابة
  const selectAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    // ✅ بدء الامتحان عند أول إجابة
    if (!examStarted) {
      startExam();
    }
    
    setStudentAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = optionIndex;
      return newAnswers;
    });
  }, [examStarted, startExam]);

  // ✅ حفظ إجابة إنشائية ← يبدأ الامتحان تلقائياً عند أول كتابة
  const saveEssayAnswer = useCallback((questionIndex: number, answer: string) => {
    if (!examStarted) {
      startExam();
    }
    
    setEssayAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = answer;
      return newAnswers;
    });
  }, [examStarted, startExam]);

  // الانتقال للسؤال التالي
  const nextQuestion = useCallback(() => {
    if (exam && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [exam, currentQuestionIndex]);

  // الانتقال للسؤال السابق (مع التحقق من الإعدادات)
  const prevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0 && exam?.settings?.allowBackNavigation) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex, exam]);

  // ✅ تسليم الامتحان - نسخة مصححة تماماً
  const submitExam = useCallback(async () => {
    if (!exam || !user) {
      alert(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      return;
    }

    // فحص الأسئلة غير المجابة
    const unansweredCount = exam.questions.filter((q, idx) => {
      if (q.type === 'essay' || q.type === 'fill-blank') {
        return !essayAnswers[idx]?.trim();
      }
      return studentAnswers[idx] === undefined;
    }).length;

    if (unansweredCount > 0) {
      if (!confirm(language === 'ar' 
        ? `لديك ${unansweredCount} أسئلة غير مجابة. هل أنت متأكد من التسليم؟` 
        : `You have ${unansweredCount} unanswered questions. Submit anyway?`)) {
        return;
      }
    }

    if (!confirm(language === 'ar' ? 'هل أنت متأكد من إنهاء الامتحان؟' : 'Are you sure you want to submit?')) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // ✅ حساب النتيجة - مقارنة صحيحة باستخدام findIndex و isCorrect
      let earnedPoints = 0;
      exam.questions.forEach((q, idx) => {
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
          const studentChoice = studentAnswers[idx];
          // ✅ البحث عن الخيار الصحيح باستخدام isCorrect
          const correctIndex = q.options?.findIndex(opt => opt.isCorrect === true) ?? -1;
          
          if (studentChoice === correctIndex && studentChoice !== undefined) {
            earnedPoints += q.points || 1;
          }
        }
      });

      const totalPoints = exam.settings?.totalPoints || exam.questions.reduce((sum, q) => sum + (q.points || 1), 0);
      const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      
      const durationInSeconds = (exam.settings?.duration || 30) * 60;
      const timeSpentInSeconds = durationInSeconds - timeRemaining;

      // ✅ إعداد payload - متوافق تماماً مع Schema في ExamResult.ts
      const payload = {
        examId: exam._id,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'طالب',
        examTopic: exam.title?.[language] || exam.title?.ar,
        
        // ✅ الأسئلة: استخدام الفهرس كـ string (يتوافق مع Schema)
        // ✅ عند إعداد payload للإرسال:
questions: exam.questions.map((q: any, idx: number) => ({
  id: String(idx),  // ✅ تحويل الفهرس لـ string
  question: q.text?.[language] || q.text?.ar,
  options: q.options?.map((opt: any) => 
    typeof opt === 'string' ? opt : (opt.text?.[language] || opt.text?.ar || '')
  ) || [],
  correctAnswer: q.options?.findIndex((opt: any) => opt.isCorrect === true) ?? -1,  // ✅ number فقط
  points: q.points || 1,
  type: q.type || 'multiple-choice'
})),
        
        // ✅ إجابات الطالب: غير المجابة تُرسل كـ null
        answers: studentAnswers.map(a => {
          if (a === undefined) return null as any;
          if (a === null) return null as any;
          const num = typeof a === 'string' ? parseInt(a) : Number(a);
          return isNaN(num) ? null as any : num;
        }),
        
        essayAnswers: essayAnswers.filter(a => a?.trim()),
        
        score: finalScore,
        duration: exam.settings?.duration || 30,
        timeSpent: timeSpentInSeconds,
        submittedAt: new Date().toISOString(),
        isReviewed: false
      };

      console.log('📤 Submitting payload:', payload);

      const response = await fetch('http://localhost:3001/api/student-exams/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email!
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('📥 Response:', result);

      if (result.success) {
        setScore(finalScore);
        setExamSubmitted(true);
        alert(language === 'ar' ? '✅ تم تسليم الامتحان بنجاح!' : '✅ Exam submitted!');
        router.push('/dashboard');
      } else {
        setError(result.error || 'فشل التسليم');
      }
    } catch (err: any) {
      console.error('💥 Submit error:', err);
      setError(language === 'ar' ? 'فشل الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setSubmitting(false);
    }
  }, [exam, user, studentAnswers, essayAnswers, timeRemaining, language, router]);

  // ✅ دالة تنسيق الوقت - تظهر كـ "دقائق:ثواني" أو "ساعات:دقائق:ثواني"
  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 0) seconds = 0; // ✅ منع القيم السالبة
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    // ✅ إذا كانت هناك ساعات، اعرضها
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ✅ وإلا اعرض دقائق:ثواني فقط
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // الحصول على نص بلغة المستخدم
  const getText = useCallback((text: { ar: string; en: string }): string => {
    return text?.[language] || text?.ar || '';
  }, [language]);

  // شاشة التحميل
  if (loading || loadingExam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">{language === 'ar' ? 'جاري تحميل الامتحان...' : 'Loading exam...'}</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن هناك امتحان
  if (!exam && !loadingExam) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{language === 'ar' ? 'الامتحان غير موجود' : 'Exam Not Found'}</h1>
            <p className="text-gray-700 mb-6">{error || (language === 'ar' ? 'يرجى اختيار امتحان صالح من لوحة التحكم' : 'Please select a valid exam from the dashboard')}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {language === 'ar' ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
            </button>
          </div>
        </main>
      </>
    );
  }

  // شاشة النتيجة بعد التسليم
  if (examSubmitted && exam) {
    if (!exam.isReviewed || exam.status !== 'published') {
      return (
        <>
          <Header />
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center p-8 bg-white rounded-2xl shadow-xl">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-gray-900 text-lg mb-2 font-medium">
                {language === 'ar' ? 'لم يتم نشر نتائج هذا الامتحان بعد' : 'Results for this exam are not published yet'}
              </p>
              <p className="text-sm text-gray-700 mb-8">
                {language === 'ar' ? 'سيقوم المعلم بمراجعة إجابتك ونشر النتيجة قريباً' : 'Your teacher will review your answers and publish the result soon'}
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {language === 'ar' ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
              </button>
            </div>
          </div>
        </>
      );
    }

    const answeredCount = studentAnswers.filter(a => a !== undefined).length + essayAnswers.filter(a => a?.trim()).length;
    
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
              score >= 70 ? 'bg-green-600' : score >= 50 ? 'bg-yellow-600' : 'bg-red-600'
            }`}>
              <Award className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {score >= 70 ? '🎉 مبروك!' : score >= 50 ? '👍 جيد!' : '💪 حاول مرة أخرى!'}
            </h1>
            
            <p className="text-6xl font-bold text-indigo-600 mb-4">{score}%</p>
            
            <div className="space-y-2 mb-8 text-gray-900">
              <p className="font-medium">✅ {language === 'ar' ? 'الأسئلة المجابة:' : 'Answered:'} <strong>{answeredCount} من {exam.questions.length}</strong></p>
              <p className="font-medium">📊 {language === 'ar' ? 'الدرجة:' : 'Score:'} <strong>{score} من 100</strong></p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-colors"
            >
              📊 {language === 'ar' ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!exam) return null;

  const question = exam.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === exam.questions.length - 1;
  const canGoBack = currentQuestionIndex > 0 && exam.settings?.allowBackNavigation;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-300 to-indigo-200 p-4" dir={dir}>
        <div className="max-w-3xl mx-auto">
          
          {/* الشريط العلوي - الوقت */}
          <div className={`fixed top-4 ${dir === 'rtl' ? 'right-4 left-4 md:left-auto' : 'left-4 right-4 md:right-auto'} md:w-96 bg-white rounded-xl shadow-lg p-4 flex items-center justify-between z-50 ${
            timeRemaining < 300 ? 'bg-red-50 border-2 border-red-200' : ''
          }`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-6 h-6 ${timeRemaining < 300 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`} />
              <span className={`text-2xl font-bold font-mono ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            {exam.settings?.timePerQuestion && (
              <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded font-medium">
                {language === 'ar' ? 'وقت لكل سؤال' : 'Per Question'}
              </span>
            )}
          </div>

          {/* بطاقة السؤال */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mt-20">
            
            {/* شريط التقدم */}
            <div className="mb-6">
              <div className={`flex justify-between text-sm text-gray-700 mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <span className="font-medium">{language === 'ar' ? `سؤال ${currentQuestionIndex + 1} من ${exam.questions.length}` : `Question ${currentQuestionIndex + 1} of ${exam.questions.length}`}</span>
                <span>{Math.round(((currentQuestionIndex + 1) / exam.questions.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / exam.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* نص السؤال */}
            <h2 className={`text-xl font-bold text-gray-900 mb-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              {getText(question.text)}
            </h2>

            {/* الخيارات (لأسئلة MCQ و True/False) */}
            {(question.type === 'multiple-choice' || question.type === 'true-false') && question.options && (
              <div className="space-y-3 mb-8">
                {question.options.map((option, optIndex) => (
                  <button
                    key={option.id}
                    onClick={() => selectAnswer(currentQuestionIndex, optIndex)}
                    className={`w-full p-4 rounded-xl border-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} transition-all duration-200 ${
                      studentAnswers[currentQuestionIndex] === optIndex
                        ? 'border-indigo-600 bg-indigo-100 text-indigo-900 shadow-md'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 bg-white'
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        studentAnswers[currentQuestionIndex] === optIndex
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {studentAnswers[currentQuestionIndex] === optIndex && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <span className="flex-1 text-gray-900 font-semibold">{getText(option.text)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* حقل الإجابة للإنشائي/فراغ */}
            {(question.type === 'essay' || question.type === 'fill-blank') && (
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'اكتب إجابتك:' : 'Type your answer:'}
                </label>
                <textarea
                  value={essayAnswers[currentQuestionIndex] || ''}
                  onChange={(e) => saveEssayAnswer(currentQuestionIndex, e.target.value)}
                  className={`w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  rows={6}
                  placeholder={language === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}
                />
                {question.modelAnswer && (
                  <p className="text-xs text-gray-500 mt-2">
                    {language === 'ar' ? '💡 تلميح: حاول تضمين الكلمات المفتاحية في إجابتك' : '💡 Tip: Try to include keywords in your answer'}
                  </p>
                )}
              </div>
            )}

            {/* أزرار التنقل */}
            <div className={`flex justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''} mt-8`}>
              <button
                onClick={prevQuestion}
                disabled={!canGoBack}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  canGoBack
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {dir === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                <span>{language === 'ar' ? 'السابق' : 'Previous'}</span>
              </button>

              {isLastQuestion ? (
                <button
                  onClick={submitExam}
                  disabled={submitting || timeRemaining === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> {language === 'ar' ? 'جاري التسليم...' : 'Submitting...'}</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> {language === 'ar' ? '✅ تسليم الامتحان' : '✅ Submit Exam'}</>
                  )}
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  <span>{language === 'ar' ? 'التالي' : 'Next'}</span>
                  {dir === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          {/* شريط التنقل السريع */}
          <div className="bg-white rounded-xl shadow-lg p-4 mt-6">
            <p className={`text-sm text-gray-700 mb-3 ${dir === 'rtl' ? 'text-center' : 'text-center'} font-medium`}>
              {language === 'ar' ? 'نظرة سريعة على الأسئلة' : 'Quick overview'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {exam.questions.map((q, index) => {
                const isAnswered = studentAnswers[index] !== undefined || essayAnswers[index]?.trim();
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-10 h-10 rounded-lg font-medium transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-indigo-600 text-white'
                        : isAnswered
                        ? 'bg-green-100 text-green-800 border-2 border-green-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={isAnswered ? (language === 'ar' ? 'تمت الإجابة' : 'Answered') : (language === 'ar' ? 'غير مجاب' : 'Unanswered')}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 font-medium">
              {error}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
