'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import {
    Plus, Edit, Trash2, Search, X, Check, BookOpen, Upload,
    Sparkles, Save, Eye, Settings, ChevronDown, ChevronUp,
    Calendar, Users, Award, Download, Filter, BarChart3,
    CheckCircle, XCircle, ArrowLeft
} from 'lucide-react';
import 'react-quill/dist/quill.snow.css';
import ReactDOM from 'react-dom';

// ✅ Polyfill for findDOMNode (Required for ReactQuill with React 19)
if (typeof window !== 'undefined' && !(ReactDOM as any).findDOMNode) {
  (ReactDOM as any).findDOMNode = (component: any) => {
    return component instanceof Element ? component : component?.current || null;
  };
}

// ✅ تعريف المحرر هنا (خارج الدالة) هو أهم خطوة لحل إيرور findDOMNode
const ReactQuill = dynamic(() => import('react-quill') as any, {
  ssr: false,
  loading: () => <div className="h-20 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
}) as any;

interface Subject {
  _id: string;
  name: { ar: string; en: string };
  code?: string;
}

interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay' | 'conditional';
  text: { ar: string; en: string };
  options?: Array<{ id: string; text: { ar: string; en: string }; isCorrect?: boolean }>;
  correctAnswer?: { ar: string; en: string };
  points: number;
  explanation?: { ar: string; en: string };
  keywords?: string[];
}
// ✅ Interface الموحد لنموذج الفورم
interface ExamForm {
  title: { ar: string; en: string };
  subjectId: string;
  type: 'daily' | 'monthly' | 'midterm' | 'final' | 'custom';
  description: { ar: string; en: string };
  settings: {
    duration: number; // الإجمالي بالدقائق (للسيرفر)
    durationHours: number;    // ✅ جديد: الساعات
    durationMinutes: number;  // ✅ جديد: الدقائق
    durationSeconds: number;  // ✅ جديد: الثواني
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: 'immediate' | 'after-publish' | 'never';
    allowReview: boolean;
    allowBackNavigation: boolean; // ✅ جديد: السماح بالرجوع للخلف
    timePerQuestion: boolean;     // ✅ جديد: تفعيل وقت لكل سؤال
    timePerQuestionSeconds: number; // ✅ جديد: عدد الثواني لكل سؤال
    allowRetake?: boolean;
    startDate?: string; 
    endDate?: string;
  };
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  availability: {
    assignedTo: 'all' | 'specific';
    classIds?: string[];
  };
}

// ✅ Interface الموحد لبيانات الامتحان من السيرفر
interface Exam {
  _id: string;
  title: { ar: string; en: string };
  subjectId: string;
  type: 'daily' | 'monthly' | 'midterm' | 'final' | 'custom';
  description?: { ar: string; en: string };
  settings: {
    duration: number;
    totalPoints: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: 'immediate' | 'after-publish' | 'never';
    allowReview: boolean;
    // ✅ يجب أن تكون التواريخ هنا أيضاً لتطابق الفورم
    startDate?: string;
    endDate?: string;
  };
  questions: Question[];
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  availability: {
    assignedTo: 'all' | 'specific';
    classIds?: string[];
  };
  aiGenerated?: boolean;
}

export default function AdminExamsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { language, t, dir } = useLanguage();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  // ✅ أضف هذا السطر ضروري جداً لتخزين الأسئلة
  const [questions, setQuestions] = useState<Question[]>([]); 
  
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  // حالة النافذة المنبثقة
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [previewMode, setPreviewMode] = useState(false);
  // نموذج الامتحان اليدوي
// ✅ نموذج الامتحان اليدوي - تهيئة صحيحة\
// ✅ نموذج الامتحان اليدوي - تهيئة صحيحة
const [examForm, setExamForm] = useState<ExamForm>({
  title: { ar: '', en: '' },
  subjectId: '',
  type: 'custom',
  description: { ar: '', en: '' },
  settings: {
    duration: 30,
    durationHours: 0,
    durationMinutes: 30,
    durationSeconds: 0,
    passingScore: 50,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResults: 'after-publish',
    allowReview: true,
    allowBackNavigation: true,  // ✅ افتراضي: مسموح
    timePerQuestion: false,  // ✅ افتراضي: وقت للامتحان ككل
    timePerQuestionSeconds: 60,
    allowRetake: false,
    startDate: undefined,
    endDate: undefined
  },
  status: 'draft',
  availability: {
    assignedTo: 'all',
    classIds: []
  }
});
const [mainTab, setMainTab] = useState<'exams' | 'subjects' | 'results' | 'profile' | 'settings' | 'admin'>('exams');
const [showSubjectModal, setShowSubjectModal] = useState(false);
const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
const [subjectForm, setSubjectForm] = useState<{ name: { ar: string; en: string }; code: string; description?: { ar: string; en: string } }>({
  name: { ar: '', en: '' },
  code: '',
  description: { ar: '', en: '' }
});
const [adminResults, setAdminResults] = useState<any[]>([]);
const [loadingResults, setLoadingResults] = useState(false);
const [isSuperAdmin, setIsSuperAdmin] = useState(false);
const [theme, setTheme] = useState<any>({
  colors: { text: '#000000', background: '#ffffff', primary: '#4f46e5', sidebar: '#0f172a' },
  typography: { headerSize: 18, bodySize: 14, inputSize: 14, fontWeight: 'bold' },
  branding: { logoUrl: '', faviconUrl: '' }
});
const [adminUsers, setAdminUsers] = useState<any[]>([]);
const [students, setStudents] = useState<any[]>([]);
  

  // نموذج الـ AI
const [aiForm, setAiForm] = useState({
  subjectId: '',
  questionCount: 10,
  questionTypes: ['multiple-choice', 'true-false'] as string[],
  totalPoints: 100,
  language: 'ar' as 'ar' | 'en',
  customInstructions: ''  // ✅ أضف هذا الحقل
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // التحقق من صلاحية الأدمن
  useEffect(() => {
    if (!loading && user) {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',');
      if (user.email && !adminEmails.includes(user.email)) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router, isSuperAdmin]);

  // جلب البيانات
  const fetchData = async () => {
    if (!user?.email) return
    
    try {
      setLoadingData(true);
      try {
        const profRes = await fetch('http://localhost:3001/api/admin-profile', { headers: { 'x-user-email': user.email } });
        const profData = await profRes.json();
        setIsSuperAdmin(profData?.data?.role === 'super' || (user.email === 'mhmmad.mosa112@gmail.com'));
      } catch {}
      
      // جلب المواد
// ✅ صحيح: يجلب المواد من /api/subjects
const subjectsRes = await fetch('http://localhost:3001/api/subjects', {
  headers: { 'x-user-email': user.email }
});
const subjectsData = await subjectsRes.json();
if (subjectsData.success) setSubjects(subjectsData.data);
      
      // جلب الامتحانات
      const examsRes = await fetch('http://localhost:3001/api/exams', {
        headers: { 'x-user-email': user.email }
      });
      const examsData = await examsRes.json();
      if (examsData.success) setExams(examsData.data);
      
      // جلب الإعدادات العامة
      if (isSuperAdmin || user.email === 'mhmmad.mosa112@gmail.com') {
        try {
          const tsRes = await fetch('http://localhost:3001/api/admin-settings', { headers: { 'x-user-email': user.email } });
          const tsData = await tsRes.json();
          if (tsData.success && tsData.data) {
            setTheme(tsData.data);
            const r = document.documentElement;
            r.style.setProperty('--dashboard-bg', tsData.data.colors?.background || '#ffffff');
            r.style.setProperty('--dashboard-text', tsData.data.colors?.text || '#000000');
            r.style.setProperty('--dashboard-primary', tsData.data.colors?.primary || '#4f46e5');
            r.style.setProperty('--dashboard-sidebar', tsData.data.colors?.sidebar || '#0f172a');
          }
        } catch {}
      }
      
    } catch (err) {
      setError('فشل جلب البيانات');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);
  
const openModal = async (exam?: Exam, isPreview = false) => {
  
  setPreviewMode(isPreview);
  setActiveTab('manual');
  
  if (exam) {
    try {
      const res = await fetch(`http://localhost:3001/api/exams/${exam._id}`, {
        headers: { 'x-user-email': user?.email || '' }
      });
      const data = await res.json();
      
      const fullExam: Exam = data?.data || exam;
      setEditingExam(fullExam);
      
      const s = fullExam.settings || ({} as any);
      const titleAr = fullExam.title?.ar || '';
      const titleEn = fullExam.title?.en || '';
      const descAr = fullExam.description?.ar || '';
      const descEn = fullExam.description?.en || '';
      
      const validTypes = ['daily', 'monthly', 'midterm', 'final', 'custom'] as const;
      const validShowResults = ['immediate', 'after-publish', 'never'] as const;
      
      const examType = validTypes.includes(fullExam.type as any) 
        ? (fullExam.type as 'daily' | 'monthly' | 'midterm' | 'final' | 'custom')
        : 'custom';
        
      const showResultsVal = validShowResults.includes(s?.showResults as any) 
        ? (s?.showResults as 'immediate' | 'after-publish' | 'never')
        : 'after-publish';
      
      const avail = (fullExam as any).availability || {
        startDate: undefined,
        endDate: undefined,
        assignedTo: 'all' as const,
        classIds: []
      };
      
      const totalMinutes = Number(s?.duration || 30);
      const durationHours = Math.floor(totalMinutes / 60);
      const durationMinutes = totalMinutes % 60;
      
      setExamForm({
        title: { ar: titleAr, en: titleEn },
        subjectId: fullExam.subjectId || '',
        type: examType,
        description: { ar: descAr, en: descEn },
        settings: {
          duration: totalMinutes,
          durationHours,
          durationMinutes,
          durationSeconds: 0,
          passingScore: s?.passingScore || 50,
          shuffleQuestions: s?.shuffleQuestions ?? true,
          shuffleOptions: s?.shuffleOptions ?? true,
          showResults: showResultsVal,
          allowReview: s?.allowReview ?? true,
          allowBackNavigation: true,
          timePerQuestion: false,
          timePerQuestionSeconds: 60,
          allowRetake: (s as any)?.allowRetake === true,
          startDate: (s as any)?.startDate,
          endDate: (s as any)?.endDate
        },
        status: fullExam.status || 'draft',
        availability: {
          assignedTo: avail.assignedTo,
          classIds: avail.classIds
        }
      });
      
      const mappedQuestions = (fullExam.questions || []).map((q: any) => ({
        id: q.id,
        type: q.type,
        text: {
          ar: q.text?.ar || (typeof q.text === 'string' ? q.text : ''),
          en: q.text?.en || ''
        },
        options: (q.options || []).map((opt: any) => ({
          id: opt.id,
          text: {
            ar: opt.text?.ar || (typeof opt.text === 'string' ? opt.text : ''),
            en: opt.text?.en || ''
          },
          isCorrect: opt.isCorrect === true
        })),
        correctAnswer: q.correctAnswer && typeof q.correctAnswer === 'object'
          ? q.correctAnswer
          : undefined,
        points: q.points || 10,
        explanation: q.explanation || { ar: '', en: '' },
        keywords: q.keywords || []
      }));
      
      setQuestions(mappedQuestions);
    } catch {
      setEditingExam(exam);
      const s = exam.settings;
      const totalMinutes = Number(s?.duration || 30);
      setExamForm({
        title: { ar: exam.title?.ar || '', en: exam.title?.en || '' },
        subjectId: exam.subjectId || '',
        type: 'custom',
        description: { ar: exam.description?.ar || '', en: exam.description?.en || '' },
        settings: {
          duration: totalMinutes,
          durationHours: Math.floor(totalMinutes / 60),
          durationMinutes: totalMinutes % 60,
          durationSeconds: 0,
          passingScore: s?.passingScore || 50,
          shuffleQuestions: s?.shuffleQuestions ?? true,
          shuffleOptions: s?.shuffleOptions ?? true,
          showResults: (s?.showResults as any) || 'after-publish',
          allowReview: s?.allowReview ?? true,
          allowBackNavigation: true,
          timePerQuestion: false,
          timePerQuestionSeconds: 60,
          startDate: (s as any)?.startDate,
          endDate: (s as any)?.endDate
        },
        status: exam.status || 'draft',
        availability: {
          assignedTo: (exam as any)?.availability?.assignedTo || 'all',
          classIds: (exam as any)?.availability?.classIds || []
        }
      });
      setQuestions(exam.questions || []);
    }
  } else {
    setEditingExam(null);
    setExamForm({
      title: { ar: '', en: '' },
      subjectId: subjects[0]?._id || '',
      type: 'custom',
      description: { ar: '', en: '' },
      settings: {
        duration: 30,
        durationHours: 0,
        durationMinutes: 30,
        durationSeconds: 0,
        passingScore: 50,
        shuffleQuestions: true,
        shuffleOptions: true,
        showResults: 'after-publish',
        allowReview: true,
        allowBackNavigation: true,
        timePerQuestion: false,
        timePerQuestionSeconds: 60,
        startDate: undefined,
        endDate: undefined
      },
      status: 'draft',
      availability: {
        assignedTo: 'all',
        classIds: []
      }
    });
    setQuestions([]);
  }
  setShowModal(true);
};

  // إضافة سؤال جديد
// ✅ تأكد أن دالة addQuestion تُنشئ الخيارات بشكل صحيح:
const addQuestion = (type: Question['type']) => {
  const newQuestion: Question = {
    id: crypto.randomUUID(),
    type,
    text: { ar: '', en: '' },
    points: 10,
    // ✅ تأكد من إنشاء الخيارات بشكل صحيح
    options: type === 'multiple-choice' || type === 'true-false' ? [
      { id: crypto.randomUUID(), text: { ar: '', en: '' }, isCorrect: false },
      { id: crypto.randomUUID(), text: { ar: '', en: '' }, isCorrect: false },
      { id: crypto.randomUUID(), text: { ar: '', en: '' }, isCorrect: false },
      { id: crypto.randomUUID(), text: { ar: '', en: '' }, isCorrect: false }
    ] : undefined,
    correctAnswer: type === 'essay' || type === 'fill-blank' ? { ar: '', en: '' } : undefined,
    keywords: type === 'essay' ? [] : undefined
  };
  setQuestions([...questions, newQuestion]);
};

// ✅ تأكد أن دالة updateQuestion تحافظ على جميع الحقول:
const updateQuestion = (id: string, updates: Partial<Question>) => {
  setQuestions(prevQuestions => 
    prevQuestions.map(q => {
      if (q.id === id) {
        return { 
          ...q, 
          ...updates,
          // ✅ الحفاظ على الخيارات إذا لم تُحدَّث
          options: updates.options || q.options,
          // ✅ الحفاظ على النص ثنائي اللغة
          text: { ...q.text, ...(updates.text || {}) }
        };
      }
      return q;
    })
  );
};
  // حذف سؤال
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };


  // حفظ الامتحان يدوياً
// حفظ الامتحان يدوياً - مع تشخيص مفصل
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user?.email) return;
  
  const validQuestions = questions.filter(q =>
    (q.text?.ar?.trim() || q.text?.en?.trim()) && q.points > 0
  );
  
  if (validQuestions.length === 0) {
    setError(language === 'ar'
      ? 'يرجى إضافة سؤال صالح واحد على الأقل (مع نص ودرجة)'
      : 'Please add at least one valid question with text and points');
    return;
  }
  
  try {
    setError('');
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    
    // ✅ جهّز payload WITHOUT duplicate status
    const payload = {
      title: {
        ar: examForm.title.ar.trim(),
        en: examForm.title.en.trim()
      },
      subjectId: examForm.subjectId,
      type: examForm.type,
      description: {
        ar: examForm.description?.ar?.trim() || '',
        en: examForm.description?.en?.trim() || ''
      },
      settings: {
        duration: examForm.settings.duration,
        totalPoints,
        passingScore: examForm.settings.passingScore,
        shuffleQuestions: examForm.settings.shuffleQuestions,
        shuffleOptions: examForm.settings.shuffleOptions,
        showResults: examForm.settings.showResults,
        allowReview: examForm.settings.allowReview,
        allowRetake: !!examForm.settings.allowRetake
      },
      status: examForm.status,  // ✅ مرة واحدة فقط!
      availability: {
        startDate: examForm.settings?.startDate || undefined,
        endDate: examForm.settings?.endDate || undefined,
        assignedTo: examForm.availability?.assignedTo || 'all',
        classIds: examForm.availability?.classIds || []
      },
      questions: validQuestions.map(q => ({
        id: q.id || crypto.randomUUID(),
        type: q.type,
        text: {
          ar: q.text?.ar?.trim() || '',
          en: q.text?.en?.trim() || ''
        },
        options: q.options?.map(opt => ({
          id: opt.id,
          text: {
            ar: opt.text?.ar?.trim() || '',
            en: opt.text?.en?.trim() || ''
          },
          isCorrect: opt.isCorrect
        })),
        correctAnswer: q.correctAnswer ? {
          ar: q.correctAnswer.ar?.trim() || '',
          en: q.correctAnswer.en?.trim() || ''
        } : undefined,
        points: q.points || 1,
        keywords: q.keywords,
        explanation: q.explanation
      }))
      // ❌ احذف هذا السطر: status: 'draft'
    };
    
    console.log('📤 Sending payload:', JSON.stringify(payload, null, 2));
    
    const url = editingExam 
      ? `http://localhost:3001/api/exams/${editingExam._id}`
      : 'http://localhost:3001/api/exams';
    
    const method = editingExam ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'x-user-email': user.email 
      },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    console.log('📥 Response:', result);
    
    if (result.success) {
      setShowModal(false);
      fetchData();  // ✅ تحديث القائمة
      alert(language === 'ar' ? '✅ تم إنشاء الامتحان بنجاح!' : '✅ Exam created successfully!');
    } else {
      setError(result.error || 'فشل غير معروف');
      console.error('❌ Server error:', result);
    }
  } catch (err: any) {
    console.error('💥 Fetch error:', err);
    setError(err.message || 'فشل الاتصال بالسيرفر');
  }
};


  // توليد امتحان بالـ AI من PDF
// توليد امتحان بالـ AI من PDF - مع تشخيص
const handleAIGenerate = async () => {
  if (!user?.email || !pdfFile || !aiForm.subjectId) {
    setError(language === 'ar' ? 'يرجى اختيار مادة ورفع ملف PDF' : 'Please select a subject and upload PDF');
    return;
  }
  
  try {
    setAiLoading(true);
    setError('');
    console.log('🤖 Starting AI generation...', { fileName: pdfFile.name, subjectId: aiForm.subjectId });
    
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('subjectId', aiForm.subjectId);
    formData.append('questionCount', aiForm.questionCount.toString());
    formData.append('questionTypes', JSON.stringify(aiForm.questionTypes));
    formData.append('totalPoints', aiForm.totalPoints.toString());
    formData.append('language', aiForm.language);
    formData.append('customInstructions', aiForm.customInstructions);  // ✅ أضف هذا

    console.log('📤 FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }
    
    const res = await fetch('http://localhost:3001/api/exams/generate-from-pdf', {
      method: 'POST',
      headers: { 'x-user-email': user.email },  // ✅ لا تضع Content-Type لـ FormData
      body: formData
    });
    
    console.log('📥 Response status:', res.status);
    const result = await res.json();
    console.log('📥 Response data:', result);
    
    if (result.success) {
      setAiResult(result.data);
      setQuestions(result.data.questions || []);
      setExamForm(f => ({
        ...f,
        title: result.data.title || f.title,
        subjectId: result.data.subjectId || f.subjectId
      }));
      setActiveTab('manual');
    } else {
      setError(result.error || 'فشل التوليد');
      console.error('❌ AI generation error:', result);
    }
  } catch (err: any) {
    console.error('💥 AI fetch error:', err);
    setError(err.message || 'فشل الاتصال بالسيرفر');
  } finally {
    setAiLoading(false);
  }
};

  // تصحيح سؤال إنشائي بالـ AI
  const gradeEssay = async (question: Question, studentAnswer: string) => {
    if (!user?.email) return;
    
    try {
      const res = await fetch('http://localhost:3001/api/exams/grade-essay', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email 
        },
        body: JSON.stringify({
          question: question.text,
          studentAnswer,
          modelAnswer: question.correctAnswer,
          keywords: question.keywords,
          points: question.points,
          language: aiForm.language
        })
      });
      
      const result = await res.json();
      return result.data;
    } catch (err: any) {
      console.error('Grading error:', err);
      return null;
    }
  };
// ✅ دالة جديدة لتصحيح سؤال إنشائي وعرض النتيجة (للتجربة)
const gradeEssayWithAI = async (question: Question) => {
  if (!user?.email) return;
  
  // للتجربة: نستخدم إجابة وهمية (يمكن استبدالها بحقل إدخال لاحقاً)
  const sampleStudentAnswer = language === 'ar' 
    ? 'هذا مثال لإجابة الطالب على السؤال الإنشائي' 
    : 'This is a sample student answer for the essay question';
  
  try {
    setError('');
    const grading = await gradeEssay(question, sampleStudentAnswer);
    
    if (grading) {
      // عرض النتيجة في نافذة منبثقة بسيطة
      alert(
        `${language === 'ar' ? 'نتيجة التصحيح:\n' : 'Grading Result:\n'}
${language === 'ar' ? 'الدرجة المقترحة:' : 'Suggested Score:'} ${grading.score}/${question.points}

${language === 'ar' ? 'التعليق:' : 'Feedback:'} ${grading.feedback?.[language] || grading.feedback?.ar}

${language === 'ar' ? 'نقاط القوة:' : 'Strengths:'} ${grading.strengths?.join(', ') || '-'}

${language === 'ar' ? 'نقاط الضعف:' : 'Weaknesses:'} ${grading.weaknesses?.join(', ') || '-'}`
      );
    }
  } catch (err: any) {
    setError(language === 'ar' ? 'فشل التصحيح بالذكاء الاصطناعي' : 'AI grading failed');
  }
};
  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black" dir={dir}>
      <Header />
      
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMainTab('exams')}
              className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'exams' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
            >
              {language === 'ar' ? 'إدارة الامتحانات' : 'Manage Exams'}
            </button>
            <button
              onClick={() => setMainTab('subjects')}
              className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'subjects' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
            >
              {language === 'ar' ? 'إدارة المواد' : 'Manage Subjects'}
            </button>
            <button
              onClick={async () => {
                setMainTab('results');
                if (!user?.email) return;
                try {
                  setLoadingResults(true);
                  const res = await fetch('http://localhost:3001/api/admin/results', {
                    headers: { 'x-user-email': user.email }
                  });
                  const data = await res.json();
                  setAdminResults(data?.data?.results || []);
                } catch {
                  setAdminResults([]);
                } finally {
                  setLoadingResults(false);
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'results' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
            >
              {language === 'ar' ? 'عرض النتائج' : 'View Results'}
            </button>
            <button
              onClick={() => setMainTab('profile')}
              className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'profile' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
            >
              {language === 'ar' ? 'ملف الأدمن' : 'Admin Profile'}
            </button>
            {(isSuperAdmin || (user?.email === 'mhmmad.mosa112@gmail.com')) && (
              <>
                <button
                  onClick={async () => {
                    setMainTab('admin');
                    if (!user?.email) return;
                    const res = await fetch('http://localhost:3001/api/admin-users', { headers: { 'x-user-email': user.email } });
                    const data = await res.json();
                    setAdminUsers(data?.data || []);
                    const sres = await fetch('http://localhost:3001/api/admin-students', { headers: { 'x-user-email': user.email } });
                    const sdata = await sres.json();
                    setStudents(sdata?.data || []);
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
                >
                  {language === 'ar' ? 'إدارة الأدمن' : 'Admin Management'}
                </button>
                <button
                  onClick={async () => {
                    setMainTab('settings');
                    if (!user?.email) return;
                    const tsRes = await fetch('http://localhost:3001/api/admin-settings', { headers: { 'x-user-email': user.email } });
                    const tsData = await tsRes.json();
                    if (tsData.success && tsData.data) setTheme(tsData.data);
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold ${mainTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-black'}`}
                >
                  {language === 'ar' ? 'الإعدادات' : 'Settings'}
                </button>
              </>
            )}
          </div>
        </div>
        {/* الشريط العلوي */}
        {mainTab === 'exams' && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-black">
                {language === 'ar' ? 'إدارة الامتحانات' : 'Manage Exams'}
              </h1>
              <p className="text-black mt-1">
                {language === 'ar' 
                  ? 'أنشئ امتحانات يدوياً أو بالذكاء الاصطناعي من PDF' 
                  : 'Create exams manually or with AI from PDF'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>{language === 'ar' ? 'إنشاء امتحان' : 'Create Exam'}</span>
            </button>
          </div>
        </div>
        )}

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* جدول الامتحانات */}
        {mainTab === 'exams' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-black">
                    {language === 'ar' ? 'الامتحان' : 'Exam'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-black hidden sm:table-cell">
                    {language === 'ar' ? 'المادة' : 'Subject'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-black hidden md:table-cell">
                    {language === 'ar' ? 'النوع' : 'Type'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-black">
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-6 py-4 text-start text-sm font-semibold text-black">
                    {language === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exams.map((exam) => {
                  const subject = subjects.find(s => s._id === exam.subjectId);
                  return (
                    <tr key={exam._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-black">
                            {language === 'ar' ? exam.title.ar : exam.title.en}
                          </p>
                          <p className="text-sm text-black">
                            {exam.questions?.length || 0} {language === 'ar' ? 'أسئلة' : 'questions'} • 
                            {exam.settings?.totalPoints || 0} {language === 'ar' ? 'درجة' : 'points'}
                          </p>
                          {exam.aiGenerated && (
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-800 mt-1">
                              <Sparkles className="w-3 h-3" />
                              {language === 'ar' ? 'مولد بالذكاء الاصطناعي' : 'AI Generated'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-black hidden sm:table-cell">
                        {subject ? (language === 'ar' ? subject.name.ar : subject.name.en) : '-'}
                      </td>
                      <td className="px-6 py-4 text-black hidden md:table-cell">
                        {exam.type === 'daily' && (language === 'ar' ? 'يومي' : 'Daily')}
                        {exam.type === 'monthly' && (language === 'ar' ? 'شهري' : 'Monthly')}
                        {exam.type === 'midterm' && (language === 'ar' ? 'فصلي' : 'Midterm')}
                        {exam.type === 'final' && (language === 'ar' ? 'نهائي' : 'Final')}
                        {exam.type === 'custom' && (language === 'ar' ? 'مخصص' : 'Custom')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          exam.status === 'published' ? 'bg-green-100 text-green-700' :
                          exam.status === 'active' ? 'bg-blue-100 text-blue-700' :
                          exam.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {exam.status === 'published' && (language === 'ar' ? 'منشور' : 'Published')}
                          {exam.status === 'active' && (language === 'ar' ? 'نشط' : 'Active')}
                          {exam.status === 'draft' && (language === 'ar' ? 'مسودة' : 'Draft')}
                          {exam.status === 'scheduled' && (language === 'ar' ? 'مجدول' : 'Scheduled')}
                          {exam.status === 'closed' && (language === 'ar' ? 'مغلق' : 'Closed')}
                        </span>
                      </td>
{/* زر نسخ الرابط - أضفه في td الإجراءات */}
<td className="px-6 py-4">
  <div className="flex gap-2">
    {/* زر التعديل */}
    <button
      onClick={() => openModal(exam)}
      className="p-2 hover:bg-indigo-50 text-indigo-800 rounded-lg"
      title={language === 'ar' ? 'تعديل' : 'Edit'}
    >
      <Edit className="w-4 h-4" />
    </button>
    
    {/* ✅ زر نسخ الرابط */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        const examLink = `${window.location.origin}/exam?id=${exam._id}`;
        navigator.clipboard.writeText(examLink);
        alert(language === 'ar' ? '✅ تم نسخ رابط الامتحان!' : '✅ Exam link copied!');
      }}
      className="p-2 hover:bg-green-50 text-green-600 rounded-lg"
      title={language === 'ar' ? 'نسخ رابط الامتحان' : 'Copy Exam Link'}
    >
      🔗
    </button>
    
    {/* زر المعاينة */}
    <button
      onClick={() => openModal(exam, true)}
  style={{
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold'
  }}
      title={language === 'ar' ? 'معاينة' : 'Preview'}
    >
      <Eye className="w-4 h-4" />
    </button>
  </div>
</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {exams.length === 0 && (
            <div className="p-12 text-center text-black">
              {language === 'ar' 
                ? 'لا توجد امتحانات. انقر "إنشاء امتحان" للبدء.' 
                : 'No exams yet. Click "Create Exam" to start.'}
            </div>
          )}
        </div>
        )}
        {mainTab === 'subjects' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">{language === 'ar' ? 'إدارة المواد' : 'Manage Subjects'}</h2>
              <button
                onClick={() => { setEditingSubject(null); setSubjectForm({ name: { ar: '', en: '' }, code: '', description: { ar: '', en: '' } }); setShowSubjectModal(true); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                {language === 'ar' ? 'إضافة مادة' : 'Add Subject'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</th>
                    <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</th>
                    <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'الرمز' : 'Code'}</th>
                    <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subjects.map(s => (
                    <tr key={s._id}>
                      <td className="px-6 py-3 text-black">{s.name.ar}</td>
                      <td className="px-6 py-3 text-black">{s.name.en}</td>
                      <td className="px-6 py-3 text-black">{s.code || '-'}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingSubject(s as any); setSubjectForm({ name: { ar: s.name.ar, en: s.name.en }, code: s.code || '', description: { ar: '', en: '' } }); setShowSubjectModal(true); }}
                            className="px-3 py-1 rounded bg-gray-100 text-black"
                          >
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {mainTab === 'results' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">{language === 'ar' ? 'نتائج الطلاب' : 'Student Results'}</h2>
            </div>
            {loadingResults ? (
              <div className="p-6">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'الطالب' : 'Student'}</th>
                      <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'البريد' : 'Email'}</th>
                      <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'المادة' : 'Exam'}</th>
                      <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'الدرجة' : 'Score'}</th>
                      <th className="px-6 py-3 text-start text-sm font-semibold text-black">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {adminResults.map((r: any) => (
                      <tr key={r._id} onClick={() => window.location.assign(`/admin/results/${r._id}`)} className="cursor-pointer hover:bg-gray-50">
                        <td className="px-6 py-3 text-black">{r.userName}</td>
                        <td className="px-6 py-3 text-black">{r.userEmail}</td>
                        <td className="px-6 py-3 text-black">{r.examTopic}</td>
                        <td className="px-6 py-3 text-black">{r.score}</td>
                        <td className="px-6 py-3 text-black">{new Date(r.submittedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {mainTab === 'admin' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold text-black mb-4">{language === 'ar' ? 'إدارة الأدمن والطلاب' : 'Admin & Students Management'}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">{language === 'ar' ? 'المعلمين (أدمن فرعي)' : 'Sub-Admins (Teachers)'}</h3>
                <div className="flex gap-2 mb-2">
                  <input id="inviteEmail" placeholder="teacher@example.com" className="flex-1 px-3 py-2 border rounded-lg font-bold text-black placeholder-black" />
                  <button
                    onClick={async () => {
                      const el = document.getElementById('inviteEmail') as HTMLInputElement;
                      if (!el?.value || !user?.email) return;
                      const res = await fetch('http://localhost:3001/api/admin-users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': user.email }, body: JSON.stringify({ email: el.value }) });
                      const data = await res.json();
                      if (data.success) {
                        setAdminUsers([...adminUsers, data.data]);
                        el.value = '';
                      } else alert(data.error || 'Failed');
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                  >
                    {language === 'ar' ? 'دعوة' : 'Invite'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Email</th>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Permissions</th>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {adminUsers.map((u: any) => (
                        <tr key={u._id}>
                          <td className="px-3 py-2">{u.email}</td>
                          <td className="px-3 py-2">
                            <label className="mr-2 text-sm"><input type="checkbox" checked={u.permissions?.canManageSubjects} onChange={async (e) => {
                              const res = await fetch(`http://localhost:3001/api/admin-users/${u._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' }, body: JSON.stringify({ permissions: { ...u.permissions, canManageSubjects: e.target.checked } }) });
                              const data = await res.json();
                              if (data.success) setAdminUsers(adminUsers.map(a => a._id === u._id ? data.data : a));
                            }} /> Subjects</label>
                            <label className="mr-2 text-sm"><input type="checkbox" checked={u.permissions?.canManageExams} onChange={async (e) => {
                              const res = await fetch(`http://localhost:3001/api/admin-users/${u._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' }, body: JSON.stringify({ permissions: { ...u.permissions, canManageExams: e.target.checked } }) });
                              const data = await res.json();
                              if (data.success) setAdminUsers(adminUsers.map(a => a._id === u._id ? data.data : a));
                            }} /> Exams</label>
                            <label className="mr-2 text-sm"><input type="checkbox" checked={u.permissions?.canViewResults !== false} onChange={async (e) => {
                              const res = await fetch(`http://localhost:3001/api/admin-users/${u._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' }, body: JSON.stringify({ permissions: { ...u.permissions, canViewResults: e.target.checked } }) });
                              const data = await res.json();
                              if (data.success) setAdminUsers(adminUsers.map(a => a._id === u._id ? data.data : a));
                            }} /> Results</label>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={async () => {
                                const ok = confirm('Delete this admin?');
                                if (!ok) return;
                                const res = await fetch(`http://localhost:3001/api/admin-users/${u._id}`, { method: 'DELETE', headers: { 'x-user-email': user?.email || '' } });
                                const data = await res.json();
                                if (data.success) setAdminUsers(adminUsers.filter(a => a._id !== u._id));
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{language === 'ar' ? 'الطلاب' : 'Students'}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Name</th>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Email</th>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Last</th>
                        <th className="px-3 py-2 text-start text-sm font-semibold text-black">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {students.map((s: any) => (
                        <tr key={s.userId}>
                          <td className="px-3 py-2">{s.userName}</td>
                          <td className="px-3 py-2">{s.userEmail}</td>
                          <td className="px-3 py-2">{new Date(s.last).toLocaleString()}</td>
                          <td className="px-3 py-2 flex gap-2">
                            <button
                              onClick={async () => {
                                // إرسال إعادة ضبط كلمة المرور عبر Firebase من الواجهة
                                try {
                                  const { sendPasswordResetEmail } = await import('firebase/auth');
                                  await sendPasswordResetEmail(auth, s.userEmail);
                                  alert('Reset email sent');
                                } catch {
                                  alert('Failed to send reset email');
                                }
                              }}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg"
                            >
                              Reset Password
                            </button>
                            {s.blocked ? (
                              <button
                                onClick={async () => {
                                  const res = await fetch('http://localhost:3001/api/admin-students/unblock', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' }, body: JSON.stringify({ userId: s.userId, userEmail: s.userEmail }) });
                                  const data = await res.json();
                                  if (data.success) setStudents(students.map(x => x.userId === s.userId ? { ...x, blocked: false } : x));
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg"
                              >
                                Unblock
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  const res = await fetch('http://localhost:3001/api/admin-students/block', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' }, body: JSON.stringify({ userId: s.userId, userEmail: s.userEmail }) });
                                  const data = await res.json();
                                  if (data.success) setStudents(students.map(x => x.userId === s.userId ? { ...x, blocked: true } : x));
                                }}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg"
                              >
                                Block
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        {mainTab === 'settings' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold text-black mb-4">{language === 'ar' ? 'إعدادات الواجهة' : 'Theme Settings'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Colors</h3>
                <label className="block text-sm font-semibold text-black mb-1">Background</label>
                <input type="color" value={theme.colors?.background || '#ffffff'} onChange={e => setTheme((t: any) => ({ ...t, colors: { ...t.colors, background: e.target.value } }))} />
                <label className="block text-sm font-semibold text-black mt-3 mb-1">Primary</label>
                <input type="color" value={theme.colors?.primary || '#4f46e5'} onChange={e => setTheme((t: any) => ({ ...t, colors: { ...t.colors, primary: e.target.value } }))} />
                <label className="block text-sm font-semibold text-black mt-3 mb-1">Sidebar</label>
                <input type="color" value={theme.colors?.sidebar || '#0f172a'} onChange={e => setTheme((t: any) => ({ ...t, colors: { ...t.colors, sidebar: e.target.value } }))} />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Typography</h3>
                <label className="block text-sm font-semibold text-black mb-1">Header Size</label>
                <input type="number" value={theme.typography?.headerSize || 18} onChange={e => setTheme((t: any) => ({ ...t, typography: { ...t.typography, headerSize: Number(e.target.value) } }))} className="w-28 px-2 py-1 border rounded" />
                <label className="block text-sm font-semibold text-black mt-3 mb-1">Body Size</label>
                <input type="number" value={theme.typography?.bodySize || 14} onChange={e => setTheme((t: any) => ({ ...t, typography: { ...t.typography, bodySize: Number(e.target.value) } }))} className="w-28 px-2 py-1 border rounded" />
                <label className="block text-sm font-semibold text-black mt-3 mb-1">Input Size</label>
                <input type="number" value={theme.typography?.inputSize || 14} onChange={e => setTheme((t: any) => ({ ...t, typography: { ...t.typography, inputSize: Number(e.target.value) } }))} className="w-28 px-2 py-1 border rounded" />
                <label className="block text-sm font-semibold text-black mt-3 mb-1">Weight</label>
                <select value={theme.typography?.fontWeight || 'bold'} onChange={e => setTheme((t: any) => ({ ...t, typography: { ...t.typography, fontWeight: e.target.value } }))} className="px-2 py-1 border rounded">
                  <option value="bold">Bold</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Branding</h3>
                <div className="mb-2">
                  <label className="block text-sm font-semibold text-black mb-1">Logo</label>
                  <input type="file" onChange={async (e) => {
                    if (!user?.email) return;
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append('file', f);
                    const res = await fetch('http://localhost:3001/api/admin-settings/upload?type=logo', { method: 'POST', headers: { 'x-user-email': user.email }, body: fd });
                    const data = await res.json();
                    if (data.success) setTheme(data.data);
                  }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Favicon</label>
                  <input type="file" onChange={async (e) => {
                    if (!user?.email) return;
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append('file', f);
                    const res = await fetch('http://localhost:3001/api/admin-settings/upload?type=favicon', { method: 'POST', headers: { 'x-user-email': user.email }, body: fd });
                    const data = await res.json();
                    if (data.success) setTheme(data.data);
                  }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={async () => {
                  if (!user?.email) return;
                  const res = await fetch('http://localhost:3001/api/admin-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-email': user.email }, body: JSON.stringify(theme) });
                  const data = await res.json();
                  if (data.success) {
                    alert('Saved');
                    const r = document.documentElement;
                    r.style.setProperty('--dashboard-bg', theme.colors?.background || '#ffffff');
                    r.style.setProperty('--dashboard-text', theme.colors?.text || '#000000');
                    r.style.setProperty('--dashboard-primary', theme.colors?.primary || '#4f46e5');
                    r.style.setProperty('--dashboard-sidebar', theme.colors?.sidebar || '#0f172a');
                  } else alert(data.error || 'Failed');
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        )}
        {mainTab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold text-black mb-2">{language === 'ar' ? 'ملف الأدمن' : 'Admin Profile'}</h2>
            <p className="text-black">{language === 'ar' ? 'سيتم إضافة الاسم والسيرة واسم المستخدم لاحقاً.' : 'Name, bio, and username will be added later.'}</p>
          </div>
        )}
      </main>

      {/* نافذة إنشاء/تعديل الامتحان */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {editingExam 
                  ? (language === 'ar' ? 'تعديل الامتحان' : 'Edit Exam')
                  : (language === 'ar' ? 'إنشاء امتحان جديد' : 'Create New Exam')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* تبويبات: يدوي / AI */}
            {!editingExam && (
              <div className="px-6 pt-4 border-b">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'manual' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    ✍️ {language === 'ar' ? 'إنشاء يدوي' : 'Manual'}
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'ai' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    🤖 {language === 'ar' ? 'توليد بالذكاء الاصطناعي' : 'AI Generate'}
                  </button>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {activeTab === 'manual' || editingExam ? (
                <>
 {/* معلومات الامتحان الأساسية */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* العنوان بالعربي */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'عنوان الامتحان (عربي)' : 'Exam Title (Arabic)'} *
    </label>
<input
  type="text"
  disabled={previewMode}  // ✅ يعطل الحقل في وضع المعاينة
  required
  value={examForm.title.ar}
  onChange={(e) => setExamForm(f => ({ ...f, title: { ...f.title, ar: e.target.value } }))}
  className={`w-full px-4 py-2 border-2 rounded-lg font-bold text-black placeholder-black ${
    previewMode 
      ? 'bg-gray-100 cursor-not-allowed border-gray-300'  // ✅ تنسيق مختلف للمعاينة
      : 'border-gray-300 focus:ring-2 focus:ring-indigo-500'
  }`}
/>
  </div>

  {/* العنوان بالإنجليزي */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'عنوان الامتحان (English)' : 'Exam Title (English)'} *
    </label>
    <input
      type="text"
      required
      value={examForm.title.en}
      onChange={(e) => setExamForm(f => ({ ...f, title: { ...f.title, en: e.target.value } }))}
      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-black placeholder-black"
    />
  </div>

  {/* المادة */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'المادة' : 'Subject'} *
    </label>
    <select
      required
      value={examForm.subjectId}
      onChange={(e) => setExamForm(f => ({ ...f, subjectId: e.target.value }))}
      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-black"
    >
      <option value="">
        {language === 'ar' ? 'اختر مادة...' : 'Select subject...'}
      </option>
      {subjects.map(s => (
        <option key={s._id} value={s._id}>
          {language === 'ar' ? s.name.ar : s.name.en} {s.code ? `(${s.code})` : ''}
        </option>
      ))}
    </select>
  </div>

  {/* نوع الامتحان */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'نوع الامتحان' : 'Exam Type'}
    </label>
    <select
      value={examForm.type}
      onChange={(e) => setExamForm(f => ({ ...f, type: e.target.value as any }))}
      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-black"
    >
      <option value="custom">{language === 'ar' ? 'مخصص' : 'Custom'}</option>
      <option value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</option>
      <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
      <option value="midterm">{language === 'ar' ? 'فصلي' : 'Midterm'}</option>
      <option value="final">{language === 'ar' ? 'نهائي' : 'Final'}</option>
    </select>
  </div>

  {/* حالة الامتحان - مرة واحدة فقط */}
  <div className="md:col-span-2">
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'حالة الامتحان' : 'Exam Status'}
    </label>
    <select
      value={examForm.status}
      onChange={(e) => setExamForm(f => ({
        ...f,
        status: e.target.value as 'draft' | 'scheduled' | 'active' | 'closed' | 'published'
      }))}
      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-black"
    >
      <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
      <option value="scheduled">{language === 'ar' ? 'مجدول' : 'Scheduled'}</option>
      <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
      <option value="published">{language === 'ar' ? 'منشور' : 'Published'}</option>
      <option value="closed">{language === 'ar' ? 'مغلق' : 'Closed'}</option>
    </select>
    <p className="text-xs text-gray-600 mt-1">
      {language === 'ar'
        ? 'فقط "منشور" أو "نشط" يظهران للطلاب'
        : 'Only "Published" or "Active" are visible to students'}
    </p>
  </div>
</div>

{/* إعدادات الامتحان */}
<div className="bg-gray-50 rounded-xl p-4">
  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
    <Settings className="w-5 h-5" />
    {language === 'ar' ? 'إعدادات الامتحان' : 'Exam Settings'}
  </h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div>
      <label className="block text-sm text-gray-800 mb-1">
        {language === 'ar' ? 'المدة (دقائق)' : 'Duration (min)'}
      </label>
      <input
        type="number"
        min="5"
        max="180"
        value={examForm.settings.duration}
        onChange={(e) => setExamForm(f => ({
          ...f, settings: { ...f.settings, duration: Number(e.target.value) }
        }))}
        className="w-full px-3 py-2 border rounded-lg text-gray-900"
      />
    </div>
    <div>
      <label className="block text-sm text-gray-800 mb-1">
        {language === 'ar' ? 'درجة النجاح %' : 'Passing Score %'}
      </label>
      <input
        type="number"
        min="0"
        max="100"
        value={examForm.settings.passingScore}
        onChange={(e) => setExamForm(f => ({
          ...f, settings: { ...f.settings, passingScore: Number(e.target.value) }
        }))}
        className="w-full px-3 py-2 border rounded-lg text-gray-900"
      />
    </div>
    <div className="col-span-2 flex items-center gap-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={examForm.settings.shuffleQuestions}
          onChange={(e) => setExamForm(f => ({
            ...f, settings: { ...f.settings, shuffleQuestions: e.target.checked }
          }))}
          className="rounded"
        />
        <span className="text-sm text-gray-700">
          {language === 'ar' ? 'خلط الأسئلة' : 'Shuffle Questions'}
        </span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={examForm.settings.shuffleOptions}
          onChange={(e) => setExamForm(f => ({
            ...f, settings: { ...f.settings, shuffleOptions: e.target.checked }
          }))}
          className="rounded"
        />
        <span className="text-sm text-gray-700">
          {language === 'ar' ? 'خلط الخيارات' : 'Shuffle Options'}
        </span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!examForm.settings.allowRetake}
          onChange={(e) => setExamForm(f => ({
            ...f, settings: { ...f.settings, allowRetake: e.target.checked }
          }))}
          className="rounded"
        />
        <span className="text-sm text-gray-700">
          {language === 'ar' ? 'السماح بإعادة المحاولة' : 'Allow Retake'}
        </span>
      </label>
    </div>
  </div>
</div>

{/* ✅ قسم إعدادات الوقت المتقدم */}
<div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
  <h3 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
    <Calendar className="w-5 h-5" />
    {language === 'ar' ? '⏱️ إعدادات الوقت' : '⏱️ Time Settings'}
  </h3>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* ✅ خيار نوع الوقت */}
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-purple-800 mb-2">
        {language === 'ar' ? 'نوع الوقت' : 'Time Type'}
      </label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border-2 border-purple-200 cursor-pointer hover:border-purple-400">
          <input
            type="radio"
            name="timeType"
            checked={!examForm.settings.timePerQuestion}
            onChange={() => setExamForm(f => ({ ...f, settings: { ...f.settings, timePerQuestion: false } }))}
            className="text-purple-600"
          />
          <span className="text-sm text-gray-800 font-medium">
            {language === 'ar' ? 'وقت للامتحان ككل' : 'Time for entire exam'}
          </span>
        </label>
        <label className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border-2 border-purple-200 cursor-pointer hover:border-purple-400">
          <input
            type="radio"
            name="timeType"
            checked={examForm.settings.timePerQuestion}
            onChange={() => setExamForm(f => ({ ...f, settings: { ...f.settings, timePerQuestion: true } }))}
            className="text-purple-600"
          />
          <span className="text-sm text-gray-800 font-medium">
            {language === 'ar' ? 'وقت لكل سؤال' : 'Time per question'}
          </span>
        </label>
      </div>
    </div>

    {/* ✅ وقت الامتحان الكلي */}
    {!examForm.settings.timePerQuestion && (
      <>
        <div>
          <label className="block text-sm font-medium text-purple-800 mb-1">
            {language === 'ar' ? 'الساعات' : 'Hours'}
          </label>
          <input
            type="number"
            min="0"
            max="23"
            value={examForm.settings.durationHours || 0}
            onChange={(e) => setExamForm(f => ({
              ...f,
              settings: {
                ...f.settings,
                durationHours: Number(e.target.value),
                duration: (Number(e.target.value) * 60) + (f.settings.durationMinutes || 0)
              }
            }))}
            className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-purple-800 mb-1">
            {language === 'ar' ? 'الدقائق' : 'Minutes'}
          </label>
          <input
            type="number"
            min="0"
            max="59"
            value={examForm.settings.durationMinutes || 0}
            onChange={(e) => setExamForm(f => ({
              ...f,
              settings: {
                ...f.settings,
                durationMinutes: Number(e.target.value),
                duration: (f.settings.durationHours || 0) * 60 + Number(e.target.value)
              }
            }))}
            className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-purple-800 mb-1">
            {language === 'ar' ? 'الثواني' : 'Seconds'}
          </label>
          <input
            type="number"
            min="0"
            max="59"
            value={examForm.settings.durationSeconds || 0}
            onChange={(e) => setExamForm(f => ({
              ...f,
              settings: { ...f.settings, durationSeconds: Number(e.target.value) }
            }))}
            className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-gray-900"
          />
        </div>
      </>
    )}

    {/* ✅ وقت لكل سؤال */}
    {examForm.settings.timePerQuestion && (
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-purple-800 mb-1">
          {language === 'ar' ? 'الثواني لكل سؤال' : 'Seconds per Question'}
        </label>
        <input
          type="number"
          min="10"
          max="3600"
          value={examForm.settings.timePerQuestionSeconds || 60}
          onChange={(e) => setExamForm(f => ({
            ...f,
            settings: { ...f.settings, timePerQuestionSeconds: Number(e.target.value) }
          }))}
          className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-gray-900"
        />
        <p className="text-xs text-purple-600 mt-1">
          {language === 'ar' ? 'سيتم الانتقال تلقائياً للسؤال التالي بعد انتهاء الوقت' : 'Will auto-advance to next question after time expires'}
        </p>
      </div>
    )}

    {/* ✅ السماح بالرجوع للخلف */}
    <div className="md:col-span-2">
      <label className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border-2 border-purple-200 cursor-pointer hover:border-purple-400">
        <input
          type="checkbox"
          checked={examForm.settings.allowBackNavigation}
          onChange={(e) => setExamForm(f => ({
            ...f,
            settings: { ...f.settings, allowBackNavigation: e.target.checked }
          }))}
          className="w-5 h-5 text-purple-600 rounded"
        />
        <div>
          <span className="text-sm font-medium text-gray-800">
            {language === 'ar' ? 'السماح بالرجوع للأسئلة السابقة' : 'Allow back navigation'}
          </span>
          <p className="text-xs text-gray-600">
            {language === 'ar' 
              ? 'إذا تم تعطيله، لن يتمكن الطالب من العودة للأسئلة السابقة' 
              : 'If disabled, students cannot go back to previous questions'}
          </p>
        </div>
      </label>
    </div>
  </div>
</div>

{/* توفر الامتحان */}
<div className="bg-blue-50 rounded-xl p-4">
  <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
    <Settings className="w-5 h-5" />
    {language === 'ar' ? 'توفر الامتحان' : 'Exam Availability'}
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm text-blue-800 mb-1">
        {language === 'ar' ? 'تاريخ البدء (اختياري)' : 'Start Date (Optional)'}
      </label>
      <input
        type="datetime-local"
        value={examForm.settings.startDate || ''}
        onChange={(e) => setExamForm(f => ({
          ...f,
          settings: { ...f.settings, startDate: e.target.value }
        }))}
        className="w-full px-3 py-2 border rounded-lg text-gray-900"
      />
    </div>
    <div>
      <label className="block text-sm text-blue-800 mb-1">
        {language === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'End Date (Optional)'}
      </label>
      <input
        type="datetime-local"
        value={examForm.settings.endDate || ''}
        onChange={(e) => setExamForm(f => ({
          ...f,
          settings: { ...f.settings, endDate: e.target.value }
        }))}
        className="w-full px-3 py-2 border rounded-lg text-gray-900"
      />
    </div>
    <div className="md:col-span-2">
      <label className="block text-sm text-blue-800 mb-1">
        {language === 'ar' ? 'متاح لـ' : 'Available For'}
      </label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="assignedTo"
            value="all"
            checked={examForm.availability?.assignedTo === 'all'}
            onChange={(e) => setExamForm(f => ({
              ...f,
              availability: {
                ...f.availability,
                assignedTo: e.target.value as 'all' | 'specific'
              }
            }))}
          />
          <span className="text-sm text-gray-700">
            {language === 'ar' ? 'جميع الطلاب' : 'All Students'}
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="assignedTo"
            value="specific"
            checked={examForm.availability?.assignedTo === 'specific'}
            onChange={(e) => setExamForm(f => ({
              ...f,
              availability: {
                ...f.availability,
                assignedTo: e.target.value as 'all' | 'specific'
              }
            }))}
          />
          <span className="text-sm text-gray-700">
            {language === 'ar' ? 'فئة محددة' : 'Specific Class'}
          </span>
        </label>
      </div>
    </div>
  </div>
  <p className="text-xs text-blue-600 mt-2">
    {language === 'ar'
      ? 'إذا تركت التواريخ فارغة، سيكون الامتحان متاحاً فور نشره'
      : 'If dates are empty, exam will be available immediately after publishing'}
  </p>
</div>

{/* إدارة الأسئلة */}
<div>
  <div className="flex justify-between items-center mb-4">
    <h3 className="font-semibold text-gray-900">
      {language === 'ar' ? 'الأسئلة' : 'Questions'} ({questions.length})
    </h3>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => addQuestion('multiple-choice')}
        className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100"
      >
        + MCQ
      </button>
      <button
        type="button"
        onClick={() => addQuestion('true-false')}
        className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100"
      >
        + T/F
      </button>
      <button
        type="button"
        onClick={() => addQuestion('essay')}
        className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100"
      >
        + {language === 'ar' ? 'إنشائي' : 'Essay'}
      </button>
    </div>
  </div>

  <div className="space-y-4">
    {questions.map((q, index) => (
      <div key={q.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-300">
        <div className="flex justify-between items-start mb-3">
          <span className="text-sm font-bold text-gray-900">
            {language === 'ar' ? `سؤال ${index + 1}` : `Question ${index + 1}`}
          </span>
          <div className="flex items-center gap-5">
            <span className="text-xs px-2 py-1 bg-gray-200 rounded">
              {q.type === 'multiple-choice' && 'MCQ'}
              {q.type === 'true-false' && 'True/False'}
              {q.type === 'essay' && (language === 'ar' ? 'إنشائي' : 'Essay')}
            </span>
            <button
              type="button"
              onClick={() => removeQuestion(q.id)}
              className="px-3 py-2 border-2 border-gray-400 rounded-lg text-gray-900 font-semibold placeholder-gray-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* نص السؤال */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
  {/* عربي */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'نص السؤال (عربي)' : 'Question Text (Arabic)'}
    </label>
    <div className="min-h-37.5">
      <ReactQuill
        value={q.text.ar}
        onChange={(content: string) => updateQuestion(q.id, { text: { ...q.text, ar: content } })}
        placeholder={language === 'ar' ? 'أدخل نص السؤال بالعربي' : 'Enter question text in Arabic'}
        className="bg-white"
      />
    </div>
  </div>

  {/* انجليزي */}
  <div>
    <label className="block text-sm font-semibold text-black mb-1">
      {language === 'ar' ? 'نص السؤال (إنجليزي)' : 'Question Text (English)'}
    </label>
    <div className="min-h-37.5">
      <ReactQuill
        value={q.text.en}
        onChange={(content: string) => updateQuestion(q.id, { text: { ...q.text, en: content } })}
        placeholder={language === 'ar' ? 'أدخل نص السؤال بالانجليزي' : 'Enter question text in English'}
        className="bg-white"
      />
    </div>
  </div>
        </div>

        {/* الخيارات لـ MCQ و True/False */}
{/* الخيارات لـ MCQ و True/False */}



{(q.type === 'multiple-choice' || q.type === 'true-false') && q.options && (
  <div className="space-y-2 mb-3">
    {q.options.map((opt, optIndex) => (
      <div key={opt.id} className="flex items-center gap-5">
        <input
          type="radio"
          name={`correct-${q.id}`}
          checked={opt.isCorrect || false}
          onChange={() => {
            const newOptions = q.options!.map(o => ({
              ...o,
              isCorrect: o.id === opt.id
            }));
            updateQuestion(q.id, { options: newOptions });
          }}
          className={`w-4 h-4 ${opt.isCorrect ? 'text-green-900 ring-2 ring-green-900' : ''}`}
        />
        <input
          type="text"
          placeholder={language === 'ar' ? `خيار ${optIndex + 1} (عربي)` : `Option ${optIndex + 1} (Arabic)`}
          value={opt.text.ar}
          onChange={(e) => {
            const newOptions = [...q.options!];
            newOptions[optIndex] = { ...opt, text: { ...opt.text, ar: e.target.value } };
            updateQuestion(q.id, { options: newOptions });
          }}
          className="flex-1 px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-800"
        />
        <input
          type="text"
          placeholder={`Option ${optIndex + 1} (English)`}
          value={opt.text.en}
          onChange={(e) => {
            const newOptions = [...q.options!];
            newOptions[optIndex] = { ...opt, text: { ...opt.text, en: e.target.value } };
            updateQuestion(q.id, { options: newOptions });
          }}
          className="flex-1 px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-800"
        />
        {/* زر حذف الخيار (لكن اترك خيارين على الأقل) */}
        {q.options!.length > 2 && (
          <button
            type="button"
            onClick={() => {
              const newOptions = q.options!.filter((_, idx) => idx !== optIndex);
              updateQuestion(q.id, { options: newOptions });
            }}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    ))}
    {/* ✅ زر إضافة خيار جديد */}
    <button
      type="button"
      onClick={() => {
        const newOptions = [...(q.options || []), {
          id: crypto.randomUUID(),
          text: { ar: '', en: '' },
          isCorrect: false
        }];
        updateQuestion(q.id, { options: newOptions });
      }}
      className="text-sm text-indigo-800 hover:underline flex items-center gap-1"
    >
      <Plus className="w-3 h-3" />
      {language === 'ar' ? 'إضافة خيار' : 'Add Option'}
    </button>
  </div>
)}

        {/* الإجابة النموذجية للإنشائي */}
        {q.type === 'essay' && (
          <div className="mb-3">
            <label className="block text-sm text-gray-800 mb-1">
              {language === 'ar' ? 'الإجابة النموذجية' : 'Model Answer'}
            </label>
            <textarea
              rows={2}
              value={q.correctAnswer?.ar || ''}
              onChange={(e) => updateQuestion(q.id, {
                correctAnswer: { ...(q.correctAnswer || { en: '' }), ar: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded-lg mb-2 text-gray-900 placeholder-gray-400"
              placeholder={language === 'ar' ? 'الإجابة النموذجية (عربي)' : 'Model answer (Arabic)'}
            />
            <textarea
              rows={2}
              value={q.correctAnswer?.en || ''}
              onChange={(e) => updateQuestion(q.id, {
                correctAnswer: { ...(q.correctAnswer || { ar: '' }), en: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded-lg mb-2 text-gray-900 placeholder-gray-400"
              placeholder="Model answer (English)"
            />
            <button
              type="button"
              onClick={() => gradeEssayWithAI(q)}
              className="mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {language === 'ar' ? 'صحّح بالذكاء الاصطناعي' : 'Grade with AI'}
            </button>
          </div>
        )}

        {/* الدرجة والكلمات المفتاحية */}
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm text-gray-800 mb-1">
              {language === 'ar' ? 'الدرجة' : 'Points'}
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={q.points}
              onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
              className="w-20 px-3 py-2 border rounded-lg"
            />
          </div>
          {q.type === 'essay' && (
            <div className="flex-1">
              <label className="block text-sm text-gray-800 mb-1">
                {language === 'ar' ? 'كلمات مفتاحية (افصل بفاصلة)' : 'Keywords (comma-separated)'}
              </label>
              <input
                type="text"
                value={q.keywords?.join(', ') || ''}
                onChange={(e) => updateQuestion(q.id, {
                  keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                })}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400"
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
</div>

{/* أزرار الحفظ أو إغلاق المعاينة */}
<div className="flex gap-3 pt-4 border-t">
  {previewMode ? (
    <button
      type="button"
      onClick={() => setShowModal(false)}
      className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
    >
      {language === 'ar' ? 'إغلاق المعاينة' : 'Close Preview'}
    </button>
  ) : (
    <>
      <button
        type="button"
        onClick={() => setShowModal(false)}
        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
      >
        {language === 'ar' ? 'إلغاء' : 'Cancel'}
      </button>
      <button
        type="submit"
        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {language === 'ar' ? 'حفظ الامتحان' : 'Save Exam'}
      </button>
    </>
  )}
</div>
</>
) : (
  // تبويب الذكاء الاصطناعي
  <div className="space-y-6">
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
        <Sparkles className="w-5 h-5" />
        {language === 'ar'
          ? 'توليد امتحان تلقائي من ملف PDF بالذكاء الاصطناعي'
          : 'Auto-generate exam from PDF using AI'}
      </h3>
      <p className="text-sm text-indigo-700">
        {language === 'ar'
          ? 'ارفع كتاباً أو مذكرة، وحدد مواصفات الامتحان، وسيقوم الذكاء الاصطناعي بإنشاء الأسئلة تلقائياً'
          : 'Upload a textbook or notes, set exam parameters, and AI will generate questions automatically'}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {language === 'ar' ? 'المادة' : 'Subject'} *
        </label>
        <select
          required
          value={aiForm.subjectId}
          onChange={(e) => setAiForm(f => ({ ...f, subjectId: e.target.value }))}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
        >
          <option value="">
            {language === 'ar' ? 'اختر مادة...' : 'Select subject...'}
          </option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>
              {language === 'ar' ? s.name.ar : s.name.en} {s.code ? `(${s.code})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {language === 'ar' ? 'عدد الأسئلة' : 'Number of Questions'}
        </label>
        <input
          type="number"
          min="5"
          max="50"
          value={aiForm.questionCount}
          onChange={(e) => setAiForm(f => ({ ...f, questionCount: Number(e.target.value) }))}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {language === 'ar' ? 'الدرجة الكلية' : 'Total Points'}
        </label>
        <input
          type="number"
          min="10"
          max="1000"
          value={aiForm.totalPoints}
          onChange={(e) => setAiForm(f => ({ ...f, totalPoints: Number(e.target.value) }))}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {language === 'ar' ? 'لغة الأسئلة' : 'Question Language'}
        </label>
        <select
          value={aiForm.language}
          onChange={(e) => setAiForm(f => ({ ...f, language: e.target.value as 'ar' | 'en' }))}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
        >
          <option value="ar">🇸🇦 العربية</option>
          <option value="en">🇬🇧 English</option>
        </select>
      </div>
    </div>

    {/* أنواع الأسئلة */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {language === 'ar' ? 'أنواع الأسئلة' : 'Question Types'}
      </label>
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'multiple-choice', label: language === 'ar' ? 'اختيار متعدد' : 'Multiple Choice' },
          { id: 'true-false', label: language === 'ar' ? 'صح / خطأ' : 'True / False' },
          { id: 'essay', label: language === 'ar' ? 'إنشائي' : 'Essay' }
        ].map(type => (
          <label key={type.id} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
            <input
              type="checkbox"
              checked={aiForm.questionTypes.includes(type.id)}
              onChange={(e) => {
                const newTypes = e.target.checked
                  ? [...aiForm.questionTypes, type.id]
                  : aiForm.questionTypes.filter(t => t !== type.id);
                setAiForm(f => ({ ...f, questionTypes: newTypes }));
              }}
              className="rounded"
            />
            <span className="text-sm text-gray-700">{type.label}</span>
          </label>
        ))}
      </div>
    </div>

    {/* تعليمات مخصصة للذكاء الاصطناعي */}
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1">
        {language === 'ar' ? 'تعليمات إضافية للذكاء الاصطناعي (اختياري)' : 'Additional AI Instructions (Optional)'}
      </label>
      <textarea
        rows={3}
        placeholder={language === 'ar'
          ? 'مثال: ركّز على الأسئلة التطبيقية، تجنب الأسئلة النظرية...'
          : 'Example: Focus on practical questions, avoid theoretical ones...'}
        value={aiForm.customInstructions}
        onChange={(e) => setAiForm(f => ({ ...f, customInstructions: e.target.value }))}
        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
      />
      <p className="text-xs text-gray-600 mt-1">
        {language === 'ar'
          ? 'هذه التعليمات ستُرفق مع طلب توليد الأسئلة'
          : 'These instructions will be included with the AI generation request'}
      </p>
    </div>

    {/* رفع PDF */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {language === 'ar' ? 'ملف PDF المصدر' : 'Source PDF File'} *
      </label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <Upload className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        {pdfFile ? (
          <p className="text-green-600 font-medium">📄 {pdfFile.name}</p>
        ) : (
          <p className="text-gray-700">
            {language === 'ar'
              ? 'انقر لرفع ملف PDF أو اسحبه هنا'
              : 'Click to upload PDF or drag & drop'}
          </p>
        )}
      </div>
    </div>

    {/* نتيجة التوليد */}
    {aiResult && (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-800 font-medium flex items-center gap-2">
          <Check className="w-5 h-5" />
          {language === 'ar' ? '✅ تم توليد الامتحان بنجاح!' : '✅ Exam generated successfully!'}
        </p>
        <p className="text-sm text-green-700 mt-1">
          {language === 'ar'
            ? `تم إنشاء ${aiResult.questions?.length || 0} أسئلة`
            : `Generated ${aiResult.questions?.length || 0} questions`}
        </p>
      </div>
    )}

    {/* أزرار التوليد */}
    <div className="flex gap-3 pt-4">
      <button
        type="button"
        onClick={() => {
          setAiResult(null);
          setPdfFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
      >
        {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
      </button>
      <button
        type="button"
        onClick={handleAIGenerate}
        disabled={aiLoading || !pdfFile || !aiForm.subjectId}
        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {aiLoading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {aiLoading
          ? (language === 'ar' ? 'جاري التوليد...' : 'Generating...')
          : (language === 'ar' ? 'توليد بالذكاء الاصطناعي' : 'Generate with AI')}
      </button>
    </div>

    {aiResult && (
      <div className="pt-4 border-t">
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Eye className="w-5 h-5" />
          {language === 'ar'
            ? 'مراجعة الأسئلة المولدة قبل الحفظ ←'
            : 'Review generated questions before saving →'}
        </button>
      </div>
    )}
  </div>
)}
</form>
</div>
</div>
)}
</div>
);
}
