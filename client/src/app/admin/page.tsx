'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import {
  Users, Award, Download, Search, Edit, Trash2, CheckCircle, UserPlus, GraduationCap, Briefcase,
  XCircle, ArrowLeft, BarChart3, Eye, X, FileText, Video, Link as LinkIcon, Image as ImageIcon,
  BookOpen, Settings, ChevronRight, Loader2, Plus, Sparkles,
  Save, Calendar, MessageSquare, Filter, Send, Megaphone, Paperclip
} from 'lucide-react';
import LiveGrid from './LiveGrid';
import ExamCommander from '../../components/admin/ExamCommander';
import { io } from 'socket.io-client';
import 'react-quill/dist/quill.snow.css';
import ReactDOM from 'react-dom';

// ✅ Polyfill for findDOMNode (Required for ReactQuill with React 19)
if (typeof window !== 'undefined' && !(ReactDOM as any).findDOMNode) {
  (ReactDOM as any).findDOMNode = (component: any) => {
    return component instanceof Element ? component : component?.current || null;
  };
}

// ✅ Dynamic Import for ReactQuill
const ReactQuill = dynamic(() => import('react-quill') as any, {
  ssr: false,
  loading: () => <div className="h-20 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
}) as any;

// ========== Interfaces ==========
interface ExamResult {
  _id: string;
  examId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  examTopic: string;
  score: number;
  duration: number;
  timeSpent: number;
  submittedAt: string;
  isReviewed: boolean;
  adminNotes?: string;
  questions?: Array<{ id: number; question: string; options: string[]; correctAnswer: number }>;
  answers?: (number | string | null)[];
  essayAnswers?: string[];
}

interface Exam {
  _id: string;
  title: { ar: string; en: string };
  subjectId: string;
  subjectName?: { ar: string; en: string };
  type: string;
  status: string;
  questions?: any[];
  settings?: any;
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

interface Grade { _id: string; name: { ar: string; en: string }; }
interface Specialization { _id: string; name: { ar: string; en: string }; }
interface AdminUser { 
  _id: string; 
  email: string; 
  name: string;
  nationalId: string;
  phone: string;
  permissions: {
    canViewDashboard: boolean;
    canManageExams: boolean;
    canViewResults: boolean;
    canMonitor: boolean;
  };
  role: 'admin' | 'super'; 
  assignments: { gradeId: string; specializationId: string }[]; 
}
interface Student { _id: string; name: string; email: string; gradeId: string; specializationId: string; }

interface Profile {
  name: string;
  phone: string;
  nationalId: string;
  socials: { twitter: string; linkedin: string; };
  avatar: string;
}
interface Message {
  id: string;
  sender: 'student' | 'admin';
  content: string;
  timestamp: string;
}

interface Subject {
  _id: string;
  name: { ar: string; en: string };
  code?: string;
}

interface Stats {
  totalStudents: number;
  totalExams: number;
  byTopic: Array<{ _id: string; count: number; avgScore: number }>;
}

type AdminTab = 'dashboard' | 'exams' | 'results' | 'subjects' | 'management' | 'monitor' | 'communication' | 'profile';
type ResultsView = 'list' | 'by-subject' | 'by-exam' | 'student-details';

// ✅ المكون الرئيسي ← جميع الـ Hooks داخل هذه الدالة
export default function AdminPage() {
  // ✅ جميع الـ Hooks هنا فقط
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { language, dir } = useLanguage();
  
  // حالة التبويبات والعرض
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [resultsView, setResultsView] = useState<ResultsView>('list');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  // بيانات
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([{ _id: 'subj1', name: { ar: 'الفيزياء', en: 'Physics' } }]);
  const [grades, setGrades] = useState<Grade[]>([{_id: '11', name: { ar: 'الحادي عشر', en: 'Grade 11'}}, {_id: '12', name: { ar: 'الثاني عشر', en: 'Grade 12'}}]);
  const [specializations, setSpecializations] = useState<Specialization[]>([{_id: 'gdesign', name: { ar: 'تصميم جرافيكي', en: 'Graphic Design'}}, {_id: 'sci', name: { ar: 'علمي', en: 'Scientific'}}]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([
    { _id: 'admin1', email: 'teacher@example.com', name: 'John Doe', nationalId: '12345', phone: '555-1234', role: 'admin', permissions: { canViewDashboard: true, canManageExams: true, canViewResults: true, canMonitor: true }, assignments: [{ gradeId: '11', specializationId: 'gdesign' }] }
  ]);
  const [students, setStudents] = useState<Student[]>([
    { _id: 'stud1', name: 'Ahmad', email: 'student@example.com', gradeId: '11', specializationId: 'gdesign' }
  ]);
  const [profile, setProfile] = useState<Profile>({ 
    name: 'Mohammed Mosa', 
    phone: '0591234567', 
    nationalId: '123456789',
    socials: { twitter: '', linkedin: '' },
    avatar: ''
  });
  const [stats, setStats] = useState<Stats | null>(null);
  
  // حالة التحميل والخطأ
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // فلاتر والبحث
  const [searchTerm, setSearchTerm] = useState('');
  const [globalFilter, setGlobalFilter] = useState({ gradeId: '', specializationId: '', subjectId: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // التحديد للحذف الجماعي
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // حالة التعديل والمراجعة
  const [editingResult, setEditingResult] = useState<ExamResult | null>(null);
  const [viewingDetails, setViewingDetails] = useState<ExamResult | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionScores, setQuestionScores] = useState<number[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // ========== حالات إنشاء الامتحان (Merged from exams/page.tsx) ==========
  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState<any>({
    title: { ar: '', en: '' },
    subjectId: '',
    type: 'custom',
    description: { ar: '', en: '' },
    settings: {
      duration: 30,
      passingScore: 50,
      shuffleQuestions: true,
      showResults: 'after-publish',
      allowReview: true
    },
    status: 'draft',
    availability: { assignedTo: 'all', classIds: [] }
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeExamTab, setActiveExamTab] = useState<'manual' | 'ai'>('manual');

  // ========== حالات التواصل (Merged from exam/page.tsx - Communication) ==========
  const [commTab, setCommTab] = useState<'inbox' | 'announcements'>('inbox');
  const [replyText, setReplyText] = useState('');
  const [announcementText, setAnnouncementText] = useState('');

  // ========== Quill Modules (with Image and Link) ==========
  const quillModules = useMemo(() => {
    // A mock image handler. In a real app, this would upload the file to a server.
    const imageHandler = () => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          alert(`Image selected: ${file.name}. In a real app, this would be uploaded.`);
          // Here you would upload the file and get a URL, then insert it.
        }
      };
    };

    return {
      toolbar: {
        container: [['bold', 'italic', 'underline'], ['link', 'image']],
        handlers: { image: imageHandler },
      },
    };
  }, []);

  // ========== التحقق من صلاحية الأدمن ==========
  useEffect(() => {
    if (!loading && user) {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',');
      // Mock logic: first email is super admin, others are sub-admins
      const userRole = adminEmails.find(admin => admin === user.email);
      if (!userRole) {
        router.push('/student/dashboard');
      } else {
        setIsSuperAdmin(userRole === adminEmails[0]);
        // If it's a sub-admin, you might want to fetch their specific assignments here
      }
    }
  }, [user, loading, router]);

  // ========== جلب البيانات ==========
  const fetchData = useCallback(async () => {
    if (!user?.email) return;
    try {
      setLoadingData(true);
      setError('');
      
      // جلب الإحصائيات
      const statsRes = await fetch('http://localhost:3001/api/admin/stats', {
        headers: { 'x-user-email': user.email }
      });
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);
      
      // جلب المواد
      const subjectsRes = await fetch('http://localhost:3001/api/subjects', {
        headers: { 'x-user-email': user.email }
      });
      const subjectsData = await subjectsRes.json();
      let subjectsMap = new Map<string, Subject>();
      if (subjectsData.success) {
        setSubjects(subjectsData.data);
        subjectsMap = new Map(subjectsData.data.map((s: Subject) => [s._id, s]));
      }

      // جلب الامتحانات
      const examsRes = await fetch('http://localhost:3001/api/exams', {
        headers: { 'x-user-email': user.email }
      });
      const examsData = await examsRes.json();
      if (examsData.success) {
        const examsWithSubjects = examsData.data.map((exam: Exam) => ({
          ...exam,
          subjectName: subjectsMap.get(exam.subjectId)?.name
        }));
        setExams(examsWithSubjects);
      }

      // جلب النتائج
      const resultsRes = await fetch('http://localhost:3001/api/admin/results', {
        headers: { 'x-user-email': user.email }
      });
      const resultsData = await resultsRes.json();
      if (resultsData.success) {
        setResults(resultsData.data.results || []);
      }
    } catch (err: any) {
      console.error('💥 Fetch error:', err);
      setError(`فشل جلب البيانات: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ========== Real-time Session Updates ==========
  useEffect(() => {
    if (!user?.email) return;
    
    const socket = io('http://localhost:3001/monitoring');
    socket.on('connect', () => {
      socket.emit('admin-join', { adminId: user.email });
    });

    socket.on('active-sessions-update', () => {
      fetchData(); // Refresh data when session counts change
    });

    return () => { socket.disconnect(); };
  }, [user, fetchData]);

  // ========== دوال المساعدة ==========
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-700 bg-green-100';
    if (score >= 50) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  const getStatusBadge = (status: string, isReviewed?: boolean) => {
    if (isReviewed !== undefined) {
      return isReviewed 
        ? <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
            {language === 'ar' ? 'تمت المراجعة' : 'Reviewed'}
          </span>
        : <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
            {language === 'ar' ? 'قيد المراجعة' : 'Pending'}
          </span>;
    }
    const colors: Record<string, string> = {
      published: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-purple-100 text-purple-700',
      closed: 'bg-red-100 text-red-700'
    };
    const labels: Record<string, string> = {
      published: language === 'ar' ? 'منشور' : 'Published',
      active: language === 'ar' ? 'نشط' : 'Active',
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      scheduled: language === 'ar' ? 'مجدول' : 'Scheduled',
      closed: language === 'ar' ? 'مغلق' : 'Closed'
    };
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>;
  };

  // ========== الحذف ==========
  const handleDelete = async (type: 'exam' | 'result' | 'subject', id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    try {
      const endpoints: Record<string, string> = {
        exam: `http://localhost:3001/api/exams/${id}`,
        result: `http://localhost:3001/api/admin/results/${id}`,
        subject: `http://localhost:3001/api/subjects/${id}`
      };
      const res = await fetch(endpoints[type], {
        method: 'DELETE',
        headers: { 'x-user-email': user!.email! }
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(result.error || 'فشل الحذف');
      }
    } catch (err: any) {
      setError('فشل الاتصال بالسيرفر');
    }
  };

  // الحذف الجماعي
  const handleBulkDelete = async (type: 'exam' | 'result' | 'subject') => {
    if (selectedIds.size === 0) return;
    if (!confirm(language === 'ar' ? `هل أنت متأكد من حذف ${selectedIds.size} عنصر؟` : `Delete ${selectedIds.size} items?`)) return;
    try {
      const endpoints: Record<string, string> = {
        exam: 'http://localhost:3001/api/exams/bulk-delete',
        result: 'http://localhost:3001/api/admin/results/bulk-delete',
        subject: 'http://localhost:3001/api/subjects/bulk-delete'
      };
      const res = await fetch(endpoints[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user!.email! },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(language === 'ar' ? `تم حذف ${selectedIds.size} عنصر` : `Deleted ${selectedIds.size} items`);
        setSelectedIds(new Set());
        setSelectAll(false);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      for (const id of selectedIds) await handleDelete(type, id);
    }
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectAll) { setSelectedIds(new Set()); } else { setSelectedIds(new Set(ids)); }
    setSelectAll(!selectAll);
  };

  // ========== التصدير ==========
  const handleExport = async (type: 'csv' | 'pdf', examId?: string) => {
    if (!user?.email) return;
    try {
      const params = new URLSearchParams();
      if (examId) params.append('examId', examId);
      if (selectedIds.size > 0) params.append('ids', Array.from(selectedIds).join(','));
      const endpoint = type === 'pdf'
        ? `http://localhost:3001/api/admin/results/export-pdf?${params}`
        : `http://localhost:3001/api/admin/results/export?${params}`;
      const response = await fetch(endpoint, { headers: { 'x-user-email': user.email } });
      if (!response.ok) throw new Error('فشل التصدير');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exam-results-${Date.now()}.${type === 'pdf' ? 'pdf' : 'csv'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(language === 'ar' ? 'تم التصدير بنجاح' : 'Exported successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Export error:', err);
      setError('فشل التصدير');
    }
  };

  // ========== دوال إدارة الأسئلة (مبسطة للدمج) ==========
  const addQuestion = (type: Question['type']) => {
    setQuestions([...questions, { id: crypto.randomUUID(), type, text: { ar: '', en: '' }, points: 10, options: [] }]);
  };

  // ========== مراجعة تفاصيل نتيجة ==========
  // ========== مراجعة تفاصيل نتيجة ==========
const viewResultDetails = async (result: ExamResult) => {
  if (!user?.email) return;
  try {
    const response = await fetch(`http://localhost:3001/api/admin/results/${result._id}`, {
      headers: { 'x-user-email': user.email }
    });
    const data = await response.json();

    if (data.success) {
      const detailedResult = data.data.result;
      setViewingDetails(detailedResult);
      setEditScore(detailedResult.score.toString());
      setEditNotes(detailedResult.adminNotes || '');

      // Initialize scores for manual override
      const qScores: number[] = detailedResult.questions?.map((q: any, idx: number) => {
        const studentAnswer = detailedResult.answers?.[idx];
        const correctAnswerNum = Number(q.correctAnswer ?? -1);
        const studentAnswerNum = Number(studentAnswer ?? -2);

        return studentAnswerNum === correctAnswerNum ? (q.points || 10) : 0;
      }) || [];

      setQuestionScores(qScores);
    }
  } catch (err) {
    setError('فشل جلب التفاصيل');
  }
};

  // ========== تحديث نتيجة ==========
  const handleUpdateResult = async (resultId: string, publish = false) => {
    if (!user?.email) return;
    try {
      const totalPoints = viewingDetails?.questions?.reduce((sum, q: any) => sum + (q.points || 10), 0) || 1;
      const earnedPoints = questionScores.reduce((a, b) => a + b, 0);
      const finalScore = Math.round((earnedPoints / totalPoints) * 100);
      const response = await fetch(`http://localhost:3001/api/admin/results/${resultId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
        body: JSON.stringify({
          score: finalScore,
          adminNotes: editNotes || `Manually reviewed.`,
          isReviewed: publish ? true : undefined  // ✅ مهم: ينشر النتيجة للطالب
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMsg(publish 
          ? (language === 'ar' ? '✅ تم النشر بنجاح - الطالب سيرى النتيجة' : 'Published - Student can see result') 
          : (language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully')
        );
        setViewingDetails(null);
        setEditingResult(null);
        setEditingId(null);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(result.error || 'فشل التحديث');
      }
    } catch (err) {
      setError('فشل التحديث');
    }
  };

  // ========== حفظ مراجعة الأسئلة ==========
  const saveQuestionReview = async (publish = false) => {
    if (!user?.email || !viewingDetails) return;
    try {
      const totalPoints = viewingDetails.questions?.reduce((sum, q: any) => sum + (q.points || 10), 0) || 1;
      const earnedPoints = questionScores.reduce((a, b) => a + b, 0);
      const totalScore = Math.round((earnedPoints / totalPoints) * 100);
      const response = await fetch(`http://localhost:3001/api/admin/results/${viewingDetails._id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': user.email 
        },
        body: JSON.stringify({
          score: totalScore,
          isReviewed: publish ? true : undefined,  // ✅ مهم: ينشر النتيجة للطالب
          adminNotes: editNotes || `تمت مراجعة ${questionScores.length} سؤال يدوياً`
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSuccessMsg(publish 
          ? (language === 'ar' ? '✅ تم النشر بنجاح - الطالب سيرى النتيجة' : 'Published - Student can see result')
          : (language === 'ar' ? 'تم الحفظ كمسودة' : 'Saved as draft')
        );
        setViewingDetails(null);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(result.error || 'فشل الحفظ');
      }
    } catch (err) {
      setError('فشل الحفظ');
    }
  };

  // ========== تحديث درجة سؤال فردي ==========
  const updateQuestionScore = (questionIndex: number, score: number) => {
    const newScores = [...questionScores];
    newScores[questionIndex] = score;
    setQuestionScores(newScores);
    // حساب النتيجة الإجمالية
    const totalScore = Math.round((newScores.reduce((a, b) => a + b, 0) / (viewingDetails?.questions?.reduce((sum, q: any) => sum + (q.points || 10), 0) || 1)) * 100);
    setEditScore(totalScore.toString());
  };

  // ========== التنقل ==========
  const handleSubjectClick = (subject: Subject) => { 
    setSelectedSubject(subject); 
    setSelectedExam(null); 
    setResultsView('by-subject'); 
  };
  
  const handleExamClick = (exam: Exam) => { 
    setSelectedExam(exam); 
    setResultsView('by-exam'); 
  };
  
  const handleBack = () => {
    if (resultsView === 'student-details') { 
      setViewingDetails(null); 
      setResultsView(selectedExam ? 'by-exam' : selectedSubject ? 'by-subject' : 'list'); 
    } else if (resultsView === 'by-exam') { 
      setSelectedExam(null); 
      setResultsView(selectedSubject ? 'by-subject' : 'list'); 
    } else if (resultsView === 'by-subject') { 
      setSelectedSubject(null); 
      setResultsView('list'); 
    } else { 
      setActiveTab('dashboard'); 
    }
    setSelectedIds(new Set()); 
    setSelectAll(false);
  };

  // ========== حفظ الامتحان (مبسط) ==========
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    alert(language === 'ar' ? 'تم حفظ الامتحان (محاكاة)' : 'Exam Saved (Simulation)');
    setShowExamModal(false);
  };

  // ========== شاشة التحميل ==========
  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-700">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // ========== عرض مراجعة تفاصيل الطالب ==========
  if (viewingDetails && resultsView === 'student-details') {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-6xl mx-auto p-4">
          {/* الشريط العلوي مع زر العودة */}
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{language === 'ar' ? 'مراجعة إجابات الطالب' : 'Review Student Answers'}</h1>
              <p className="text-gray-600 text-sm">{viewingDetails.userName} • {viewingDetails.examTopic}</p>
            </div>
            <div className="flex gap-2">
              {/* ✅ زر نشر النتيجة */}
              <button
                onClick={() => saveQuestionReview(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold"
              >
                ✅ {language === 'ar' ? 'نشر للطالب' : 'Publish for Student'}
              </button>
              {/* زر حفظ كمسودة */}
              <button
                onClick={() => saveQuestionReview(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                💾 {language === 'ar' ? 'حفظ كمسودة' : 'Save as Draft'}
              </button>
              <button onClick={() => setViewingDetails(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* قائمة الأسئلة */}
          <div className="space-y-4">
            {viewingDetails.questions?.map((q: any, idx) => (
              <div key={q.id} className="bg-white rounded-xl p-6 shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-500">{language === 'ar' ? `سؤال ${idx + 1}` : `Question ${idx + 1}`}</p>
                    <p className="font-bold text-lg">{q.question}</p>
                  </div>
                </div>
                
                {q.type === 'essay' || q.type === 'fill-blank' ? (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm font-bold text-blue-800">{language === 'ar' ? 'إجابة الطالب' : 'Student\'s Answer'}</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{viewingDetails.essayAnswers?.[idx] || (language === 'ar' ? 'لم تتم الإجابة' : 'Not Answered')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <p className="text-sm font-bold text-green-800">{language === 'ar' ? 'الإجابة النموذجية' : 'Model Answer'}</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{q.modelAnswer?.[language] || q.modelAnswer?.ar || (language === 'ar' ? 'لا توجد إجابة نموذجية' : 'No Model Answer')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {q.options?.map((opt: string, optIdx: number) => (
                      <div key={optIdx} className={`p-3 rounded-lg border ${
                        optIdx === q.correctAnswer ? 'border-green-500 bg-green-50' :
                        optIdx === viewingDetails.answers?.[idx] ? 'border-red-500 bg-red-50' : 'border-gray-200'
                      }`}>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>{opt}
                        {optIdx === q.correctAnswer && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                        {optIdx === viewingDetails.answers?.[idx] && optIdx !== q.correctAnswer && <XCircle className="w-4 h-4 text-red-600 inline ml-2" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* تعديل درجة السؤال */}
                <div className="mt-4 flex items-center gap-4 border-t pt-4">
                  <label className="text-sm font-bold text-gray-800">{language === 'ar' ? 'تعديل يدوي للدرجة:' : 'Manual Score Override:'}</label>
                  <input
                    type="number"
                    min="0"
                    max={q.points || 10}
                    value={questionScores[idx] ?? ''}
                    onChange={(e) => updateQuestionScore(idx, Number(e.target.value))}
                    className="w-24 px-3 py-2 border rounded-lg text-center font-bold"
                  />
                  <span className="text-sm text-gray-600">/ {q.points || 10} {language === 'ar' ? 'نقاط' : 'Points'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ملاحظات الأدمن والدرجة */}
          <div className="mt-6 bg-white rounded-xl p-6 shadow">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'ar' ? 'ملاحظات الأدمن' : 'Admin Notes'}
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              rows={3}
              placeholder={language === 'ar' ? 'أضف ملاحظاتك هنا...' : 'Add notes...'}
            />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600">{language === 'ar' ? 'الدرجة:' : 'Score:'}</p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                  className="w-20 px-3 py-2 border rounded-lg font-bold text-lg"
                />
              </div>
              <button
                onClick={() => saveQuestionReview(false)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                💾 {language === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========== الواجهة الرئيسية ==========
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {resultsView !== 'list' && activeTab === 'results' && (
              <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg" title={language === 'ar' ? 'عودة' : 'Back'}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-900">
              {activeTab === 'dashboard' && (language === 'ar' ? 'لوحة التحكم' : 'Dashboard')}
              {activeTab === 'exams' && (language === 'ar' ? 'إدارة الامتحانات' : 'Manage Exams')}
              {activeTab === 'results' && (
                resultsView === 'list' ? (language === 'ar' ? 'سجل النتائج' : 'Results') :
                resultsView === 'by-subject' ? selectedSubject?.name[language === 'ar' ? 'ar' : 'en'] :
                resultsView === 'by-exam' ? (language === 'ar' ? selectedExam?.title.ar : selectedExam?.title.en) :
                (language === 'ar' ? 'تفاصيل الطالب' : 'Student Details')
              )}
              {activeTab === 'subjects' && (language === 'ar' ? 'المواد الدراسية' : 'Subjects')}              {activeTab === 'management' && isSuperAdmin && (language === 'ar' ? 'إدارة النظام' : 'System Management')}
              {activeTab === 'monitor' && (language === 'ar' ? 'المراقبة المباشرة' : 'Live Monitor')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">{user?.email}</span>
            <button onClick={() => router.push('/student/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg" title={language === 'ar' ? 'عرض واجهة الطالب' : 'View Student Dashboard'}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* التبويبات */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-xl p-2 shadow border border-gray-200">
          {[
            { id: 'dashboard', label: '📊 ' + (language === 'ar' ? 'الإحصائيات' : 'Stats'), icon: BarChart3, adminOnly: false },
            { id: 'subjects', label: '📚 ' + (language === 'ar' ? 'المواد' : 'Subjects'), icon: BookOpen, adminOnly: false },
            { id: 'exams', label: '📝 ' + (language === 'ar' ? 'الامتحانات' : 'Exams'), icon: FileText, adminOnly: false },
            { id: 'results', label: '📋 ' + (language === 'ar' ? 'النتائج' : 'Results'), icon: Award, adminOnly: false },
            { id: 'monitor', label: '📹 ' + (language === 'ar' ? 'المراقبة' : 'Monitor'), icon: Video, adminOnly: false },
            { id: 'communication', label: '💬 ' + (language === 'ar' ? 'التواصل' : 'Communication'), icon: MessageSquare, adminOnly: false },
            { id: 'management', label: '⚙️ ' + (language === 'ar' ? 'الإدارة' : 'Management'), icon: Settings, adminOnly: true },
            { id: 'profile', label: '👤 ' + (language === 'ar' ? 'ملفي' : 'Profile'), icon: Users, adminOnly: false },
          ].filter(tab => !tab.adminOnly || isSuperAdmin).map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as AdminTab); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-800 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>



        {/* رسائل التنبيه */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-green-600"><X className="w-4 h-4" /></button>
          </div>
        )}
        {/* ========== تبويب الإحصائيات ========== */}
        {activeTab === 'dashboard' && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: language === 'ar' ? 'إجمالي الطلاب' : 'Total Students', value: stats.totalStudents, color: 'text-indigo-600' },
              { icon: FileText, label: language === 'ar' ? 'إجمالي الامتحانات' : 'Total Exams', value: stats.totalExams, color: 'text-green-600' },
              { icon: Award, label: language === 'ar' ? 'متوسط الدرجات' : 'Avg Score', value: `${stats.byTopic.length > 0 ? Math.round(stats.byTopic.reduce((a, t) => a + t.avgScore, 0) / stats.byTopic.length) : 0}%`, color: 'text-blue-600' },
              { icon: BookOpen, label: language === 'ar' ? 'عدد المواد' : 'Subjects', value: stats.byTopic.length, color: 'text-purple-600' }
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-3">
                  <item.icon className={`w-8 h-8 ${item.color}`} />
                  <div>
                    <p className="text-sm text-gray-600">{item.label}</p>
                    <p className="text-2xl font-bold">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </>
        )}

        {/* ========== تبويب الامتحانات ========== */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            {isSuperAdmin && (
              <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
                  <label className="font-medium">{language === 'ar' ? 'فلترة حسب:' : 'Filter by:'}</label>
                  <select value={globalFilter.gradeId} onChange={e => setGlobalFilter(f => ({...f, gradeId: e.target.value, specializationId: '', subjectId: ''}))} className="p-2 border rounded-lg">
                      <option value="">{language === 'ar' ? 'كل المراحل' : 'All Grades'}</option>
                      {grades.map(g => <option key={g._id} value={g._id}>{g.name.ar}</option>)}
                  </select>
                  <select value={globalFilter.specializationId} onChange={e => setGlobalFilter(f => ({...f, specializationId: e.target.value, subjectId: ''}))} className="p-2 border rounded-lg" disabled={!globalFilter.gradeId}>
                      <option value="">{language === 'ar' ? 'كل التخصصات' : 'All Specializations'}</option>
                      {specializations.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                  </select>
                  <select value={globalFilter.subjectId} onChange={e => setGlobalFilter(f => ({...f, subjectId: e.target.value}))} className="p-2 border rounded-lg" disabled={!globalFilter.specializationId}>
                      <option value="">{language === 'ar' ? 'كل المواد' : 'All Subjects'}</option>
                      {subjects.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                  </select>
                  <button onClick={() => setGlobalFilter({gradeId: '', specializationId: '', subjectId: ''})} className="text-sm text-gray-600 hover:underline">
                    {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  </button>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExamModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  <FileText className="w-4 h-4" /> {language === 'ar' ? 'إنشاء امتحان' : 'Create Exam'}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => handleBulkDelete('exam')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" /> {language === 'ar' ? `حذف (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                  </button>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-start">
                      <input type="checkbox" checked={selectAll} onChange={() => toggleSelectAll(exams.map(e => e._id))} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-start">{language === 'ar' ? 'الامتحان' : 'Exam'}</th>
                    <th className="px-4 py-3 text-start hidden md:table-cell">{language === 'ar' ? 'المادة' : 'Subject'}</th>
                    <th className="px-4 py-3 text-start hidden sm:table-cell">{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="px-4 py-3 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-3 text-start">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exams.map(exam => (
                    <tr key={exam._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(exam._id)} onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          e.target.checked ? newSet.add(exam._id) : newSet.delete(exam._id);
                          setSelectedIds(newSet);
                        }} className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{language === 'ar' ? exam.title.ar : exam.title.en}</p>
                        <p className="text-sm text-gray-600">{exam.questions?.length || 0} {language === 'ar' ? 'أسئلة' : 'questions'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-800 hidden md:table-cell">
                        {exam.subjectName ? (language === 'ar' ? exam.subjectName.ar : exam.subjectName.en) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 hidden sm:table-cell">
                        {exam.type === 'daily' && (language === 'ar' ? 'يومي' : 'Daily')}
                        {exam.type === 'monthly' && (language === 'ar' ? 'شهري' : 'Monthly')}
                        {exam.type === 'midterm' && (language === 'ar' ? 'فصلي' : 'Midterm')}
                        {exam.type === 'final' && (language === 'ar' ? 'نهائي' : 'Final')}
                        {exam.type === 'custom' && (language === 'ar' ? 'مخصص' : 'Custom')}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(exam.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => alert('Edit functionality to be implemented in modal.')} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete('exam', exam._id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => router.push(`/exam?id=${exam._id}`)} className="p-2 hover:bg-blue-50 text-blue-600 rounded">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // ✅ تصحيح الرابط ليشير إلى لوحة تحكم الطالب
                              const examLink = `${window.location.origin}/student/dashboard?examId=${exam._id}`;
                              navigator.clipboard.writeText(examLink);
                              alert(language === 'ar' ? `✅ تم نسخ رابط الامتحان!\n${examLink}` : `✅ Exam link copied!\n${examLink}`);
                            }}
                            className="p-2 hover:bg-green-50 text-green-600 rounded"
                            title={language === 'ar' ? 'نسخ رابط الامتحان' : 'Copy Exam Link'}
                          >
                            🔗
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {exams.length === 0 && (
                <div className="p-8 text-center text-gray-600">{language === 'ar' ? 'لا توجد امتحانات' : 'No exams yet'}</div>
              )}
            </div>
          </div>
        )}

        {/* ========== تبويب النتائج ========== */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {isSuperAdmin && resultsView === 'list' && (
              <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
                  <label className="font-medium">{language === 'ar' ? 'فلترة حسب:' : 'Filter by:'}</label>
                  <select value={globalFilter.gradeId} onChange={e => setGlobalFilter(f => ({...f, gradeId: e.target.value, specializationId: '', subjectId: ''}))} className="p-2 border rounded-lg">
                      <option value="">{language === 'ar' ? 'كل المراحل' : 'All Grades'}</option>
                      {grades.map(g => <option key={g._id} value={g._id}>{g.name.ar}</option>)}
                  </select>
                  <select value={globalFilter.specializationId} onChange={e => setGlobalFilter(f => ({...f, specializationId: e.target.value, subjectId: ''}))} className="p-2 border rounded-lg" disabled={!globalFilter.gradeId}>
                      <option value="">{language === 'ar' ? 'كل التخصصات' : 'All Specializations'}</option>
                      {specializations.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                  </select>
                  <select value={globalFilter.subjectId} onChange={e => setGlobalFilter(f => ({...f, subjectId: e.target.value}))} className="p-2 border rounded-lg" disabled={!globalFilter.specializationId}>
                      <option value="">{language === 'ar' ? 'كل المواد' : 'All Subjects'}</option>
                      {subjects.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                  </select>
                  <button onClick={() => setGlobalFilter({gradeId: '', specializationId: '', subjectId: ''})} className="text-sm text-gray-600 hover:underline">
                    {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  </button>
              </div>
            )}


            {resultsView !== 'list' && (
              <div className="flex items-center gap-2 text-sm bg-white rounded-lg p-3 shadow-sm">
                <button onClick={() => { setResultsView('list'); setSelectedSubject(null); setSelectedExam(null); }} className="text-indigo-600 hover:underline">
                  {language === 'ar' ? 'كل النتائج' : 'All Results'}
                </button>
                {selectedSubject && (
                  <>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <button onClick={() => { setSelectedExam(null); setResultsView('by-subject'); }} className="text-indigo-600 hover:underline">
                      {language === 'ar' ? selectedSubject.name.ar : selectedSubject.name.en}
                    </button>
                  </>
                )}
                {selectedExam && (
                  <>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-800 font-medium">
                      {language === 'ar' ? selectedExam.title.ar : selectedExam.title.en}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-50">
                  <label className="block text-sm text-gray-700 mb-1">{language === 'ar' ? 'بحث' : 'Search'}</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'ابحث باسم الطالب...' : 'Search by student name...'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="w-40">
                  <label className="block text-sm text-gray-700 mb-1">{language === 'ar' ? 'الحالة' : 'Status'}</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                    <option value="reviewed">{language === 'ar' ? 'تمت المراجعة' : 'Reviewed'}</option>
                    <option value="pending">{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</option>
                  </select>
                </div>
                <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </button>
              </div>
            </div>
            {resultsView === 'list' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {subjects.map(subject => {
                    const examCount = exams.filter(e => e.subjectId === subject._id).length;
                    const resultCount = results.filter(r => r.examTopic.includes(subject.name.ar) || r.examTopic.includes(subject.name.en)).length;
                    return (
                      <button
                        key={subject._id}
                        onClick={() => handleSubjectClick(subject)}
                        className="bg-white rounded-xl shadow p-4 text-start hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <BookOpen className="w-6 h-6 text-indigo-600" />
                          <h3 className="font-semibold">{language === 'ar' ? subject.name.ar : subject.name.en}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{examCount} {language === 'ar' ? 'امتحانات' : 'exams'} • {resultCount} {language === 'ar' ? 'نتيجة' : 'results'}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold">{language === 'ar' ? 'آخر النتائج' : 'Recent Results'}</h3>
                    {selectedIds.size > 0 && (
                      <button onClick={() => handleBulkDelete('result')} className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                        <Trash2 className="w-4 h-4" /> {language === 'ar' ? `حذف (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                      </button>
                    )}
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-start"><input type="checkbox" checked={selectAll} onChange={() => toggleSelectAll(results.map(r => r._id))} className="rounded" /></th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الطالب' : 'Student'}</th>
                        <th className="px-4 py-3 text-start hidden md:table-cell">{language === 'ar' ? 'المادة' : 'Subject'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الدرجة' : 'Score'}</th>
                        <th className="px-4 py-3 text-start hidden sm:table-cell">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.map(result => (
                        <tr key={result._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(result._id)} onChange={(e) => { const newSet = new Set(selectedIds); e.target.checked ? newSet.add(result._id) : newSet.delete(result._id); setSelectedIds(newSet); }} className="rounded" /></td>
                          <td className="px-4 py-3"><p className="font-medium">{result.userName}</p><p className="text-sm text-gray-600">{result.userEmail}</p></td>
                          <td className="px-4 py-3 text-gray-800 hidden md:table-cell">{result.examTopic}</td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(result.score)}`}>{result.score}%</span></td>
                          <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{formatDate(result.submittedAt)}</td>
                          <td className="px-4 py-3">{getStatusBadge('', result.isReviewed)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); const examLink = `${window.location.origin}/student/dashboard?examId=${result.examId || ''}`; navigator.clipboard.writeText(examLink); alert(language === 'ar' ? '✅ تم نسخ رابط الامتحان!' : '✅ Exam link copied!'); }} className="p-2 hover:bg-green-50 text-green-600 rounded" disabled={!result.examId}>🔗</button>
                              <button onClick={() => { setResultsView('student-details'); viewResultDetails(result); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => { setEditingResult(result); setEditScore(result.score.toString()); setEditNotes(result.adminNotes || ''); }} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete('result', result._id)} className="p-2 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length === 0 && <div className="p-8 text-center text-gray-600">{language === 'ar' ? 'لا توجد نتائج' : 'No results'}</div>}
                </div>
              </>
            )}
            {resultsView === 'by-subject' && selectedSubject && (
              <>
                <h3 className="text-lg font-semibold mb-4">{language === 'ar' ? 'امتحانات هذه المادة' : 'Exams for this Subject'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {exams.filter(e => e.subjectId === selectedSubject._id).map(exam => (
                    <button key={exam._id} onClick={() => handleExamClick(exam)} className="bg-white rounded-xl shadow p-4 text-start hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{language === 'ar' ? exam.title.ar : exam.title.en}</h4>
                          <p className="text-sm text-gray-600">{exam.questions?.length || 0} {language === 'ar' ? 'أسئلة' : 'questions'}</p>
                        </div>
                        {getStatusBadge(exam.status)}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {resultsView === 'by-exam' && selectedExam && (
              <>
                <div className="bg-white rounded-xl shadow p-4 mb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{language === 'ar' ? selectedExam.title.ar : selectedExam.title.en}</h3>
                      <p className="text-gray-600">{selectedExam.subjectName?.[language === 'ar' ? 'ar' : 'en']} • {selectedExam.questions?.length} {language === 'ar' ? 'أسئلة' : 'questions'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleExport('pdf', selectedExam._id)} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                        <FileText className="w-4 h-4" /> PDF
                      </button>
                      <button onClick={() => handleExport('csv')} className="p-2 hover:bg-gray-100 rounded"><Download className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-start"><input type="checkbox" checked={selectAll} onChange={() => toggleSelectAll(results.map(r => r._id))} className="rounded" /></th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الطالب' : 'Student'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الدرجة' : 'Score'}</th>
                        <th className="px-4 py-3 text-start hidden sm:table-cell">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th className="px-4 py-3 text-start">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.map(result => (
                        <tr key={result._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(result._id)} onChange={(e) => { const newSet = new Set(selectedIds); e.target.checked ? newSet.add(result._id) : newSet.delete(result._id); setSelectedIds(newSet); }} className="rounded" /></td>
                          <td className="px-4 py-3"><p className="font-medium">{result.userName}</p><p className="text-sm text-gray-600">{result.userEmail}</p></td>
                          <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(result.score)}`}>{result.score}%</span></td>
                          <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{formatDate(result.submittedAt)}</td>
                          <td className="px-4 py-3">{getStatusBadge('', result.isReviewed)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => { setResultsView('student-details'); viewResultDetails(result); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => { setEditingResult(result); setEditScore(result.score.toString()); setEditNotes(result.adminNotes || ''); }} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete('result', result._id)} className="p-2 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length === 0 && <div className="p-8 text-center text-gray-600">{language === 'ar' ? 'لا توجد نتائج لهذا الامتحان' : 'No results for this exam'}</div>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== تبويب المواد ========== */}
        {activeTab === 'subjects' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{language === 'ar' ? 'إدارة المواد' : 'Manage Subjects'}</h2>
              {selectedIds.size > 0 && (
                <button onClick={() => handleBulkDelete('subject')} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                  <Trash2 className="w-4 h-4" /> {language === 'ar' ? `حذف (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {subjects.map(subject => (
                <div key={subject._id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.has(subject._id)} onChange={(e) => { const newSet = new Set(selectedIds); e.target.checked ? newSet.add(subject._id) : newSet.delete(subject._id); setSelectedIds(newSet); }} className="rounded" />
                    <div>
                      <p className="font-medium">{language === 'ar' ? subject.name.ar : subject.name.en}</p>
                      {subject.code && <p className="text-sm text-gray-600">{subject.code}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-indigo-50 text-indigo-600 rounded"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete('subject', subject._id)} className="p-2 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {subjects.length === 0 && <p className="text-gray-600 text-center py-4">{language === 'ar' ? 'لا توجد مواد' : 'No subjects'}</p>}
            </div>
          </div>
        )}

        {/* ========== تبويب المراقبة المباشرة ========== */}
        {activeTab === 'monitor' && user?.email && isSuperAdmin && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
                <label className="font-medium">{language === 'ar' ? 'اختر الامتحان للمراقبة:' : 'Select Exam to Monitor:'}</label>
                <select value={globalFilter.gradeId} onChange={e => setGlobalFilter(f => ({...f, gradeId: e.target.value, specializationId: '', subjectId: ''}))} className="p-2 border rounded-lg">
                    <option value="">{language === 'ar' ? 'اختر المرحلة' : 'Select Grade'}</option>
                    {grades.map(g => <option key={g._id} value={g._id}>{g.name.ar}</option>)}
                </select>
                <select value={globalFilter.specializationId} onChange={e => setGlobalFilter(f => ({...f, specializationId: e.target.value, subjectId: ''}))} className="p-2 border rounded-lg" disabled={!globalFilter.gradeId}>
                    <option value="">{language === 'ar' ? 'اختر التخصص' : 'Select Specialization'}</option>
                    {specializations.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                </select>
                <select onChange={(e) => setSelectedExam(exams.find(ex => ex._id === e.target.value) || null)} className="p-2 border rounded-lg" disabled={!globalFilter.specializationId}>
                    <option value="">{language === 'ar' ? 'اختر الامتحان' : 'Select Exam'}</option>
                    {exams.filter(e => e.subjectId === subjects[0]?._id).map(exam => <option key={exam._id} value={exam._id}>{exam.title.ar}</option>)}
                </select>
            </div>
            {/* Show Commander if an exam is selected or active */}
            {selectedExam && (
               <ExamCommander
                 examId={selectedExam._id} 
                 examTitle={language === 'ar' ? selectedExam.title.ar : selectedExam.title.en} 
                 adminEmail={user.email} 
               />
            )}
            <LiveGrid userEmail={user.email} isSuperAdmin={isSuperAdmin} />
          </div>
        )}

        {/* ========== تبويب إدارة النظام ========== */}
        {activeTab === 'management' && isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Admins/Teachers */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Users /> {language === 'ar' ? 'إدارة المعلمين' : 'Manage Teachers'}</h3>
                <button className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><UserPlus className="w-4 h-4" /> {language === 'ar' ? 'إضافة معلم' : 'Add Teacher'}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left bg-gray-50"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Assignments</th><th className="p-2">Actions</th></tr></thead>
                  <tbody>{adminUsers.map(u => <tr key={u._id} className="border-b"><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2">{u.assignments.length} classes</td><td className="p-2"><button><Edit className="w-4 h-4" /></button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
            {/* Students */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><GraduationCap /> {language === 'ar' ? 'إدارة الطلاب' : 'Manage Students'}</h3>
                <button className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><UserPlus className="w-4 h-4" /> {language === 'ar' ? 'إضافة طالب' : 'Add Student'}</button>
              </div>
               <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left bg-gray-50"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Class</th><th className="p-2">Actions</th></tr></thead>
                  <tbody>{students.map(s => <tr key={s._id} className="border-b"><td className="p-2">{s.name}</td><td className="p-2">{s.email}</td><td className="p-2">{grades.find(g=>g._id === s.gradeId)?.name.ar} - {specializations.find(sp=>sp._id === s.specializationId)?.name.ar}</td><td className="p-2"><button><Edit className="w-4 h-4" /></button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
            {/* Grades & Specializations */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Briefcase /> {language === 'ar' ? 'التخصصات' : 'Specializations'}</h3>
                  <button className="p-2 bg-gray-100 rounded-lg"><Plus className="w-4 h-4" /></button>
                </div>
                <ul className="space-y-2">{specializations.map(s => <li key={s._id} className="p-2 bg-gray-50 rounded">{s.name.ar}</li>)}</ul>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Calendar /> {language === 'ar' ? 'المراحل' : 'Grades'}</h3>
                  <button className="p-2 bg-gray-100 rounded-lg"><Plus className="w-4 h-4" /></button>
                </div>
                <ul className="space-y-2">{grades.map(g => <li key={g._id} className="p-2 bg-gray-50 rounded">{g.name.ar}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {/* ========== تبويب الملف الشخصي ========== */}
        {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">{language === 'ar' ? 'الملف الشخصي' : 'Profile'}</h2>
              <div className="flex items-center gap-6 mb-6">
                <img src={profile.avatar || `https://ui-avatars.com/api/?name=${profile.name}&background=random`} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
                <div>
                  <h3 className="text-xl font-bold">{profile.name}</h3>
                  <p className="text-gray-600">{user?.email}</p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Profile Saved (Simulation)'); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input type="text" value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value}))} className="w-full p-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                    <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))} className="w-full p-2 border rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'رقم الهوية' : 'National ID'}</label>
                  <input type="text" value={profile.nationalId} onChange={e => setProfile(p => ({...p, nationalId: e.target.value}))} className="w-full p-2 border rounded-lg" />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'رابط تويتر' : 'Twitter URL'}</label>
                    <input type="url" value={profile.socials.twitter} onChange={e => setProfile(p => ({...p, socials: {...p.socials, twitter: e.target.value}}))} className="w-full p-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'رابط لينكدإن' : 'LinkedIn URL'}</label>
                    <input type="url" value={profile.socials.linkedin} onChange={e => setProfile(p => ({...p, socials: {...p.socials, linkedin: e.target.value}}))} className="w-full p-2 border rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'رابط الصورة الشخصية' : 'Avatar URL'}</label>
                  <input type="url" value={profile.avatar} onChange={e => setProfile(p => ({...p, avatar: e.target.value}))} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="flex justify-end pt-4">
                  <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">{language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
        )}

        {/* ========== تبويب التواصل (الجديد) ========== */}
        {activeTab === 'communication' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                {language === 'ar' ? 'مركز التواصل' : 'Communication Center'}
              </h2>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setCommTab('inbox')} className={`px-4 py-2 rounded-md text-sm font-medium ${commTab === 'inbox' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>
                  {language === 'ar' ? 'البريد الوارد' : 'Inbox'}
                </button>
                <button onClick={() => setCommTab('announcements')} className={`px-4 py-2 rounded-md text-sm font-medium ${commTab === 'announcements' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>
                  {language === 'ar' ? 'التعاميم' : 'Announcements'}
                </button>
              </div>
            </div>

            {commTab === 'inbox' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-150">
                {/* قائمة المحادثات */}
                <div className="border rounded-xl overflow-hidden flex flex-col">
                  <div className="p-4 bg-gray-50 border-b">
                    <input type="text" placeholder={language === 'ar' ? 'بحث...' : 'Search...'} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    <div className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer border-l-4 border-indigo-600 bg-indigo-50">
                      <p className="font-bold">Ahmed Ali</p>
                      <p className="text-xs text-gray-500">Physics Exam Question...</p>
                    </div>
                    <div className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <p className="font-bold">Sarah Smith</p>
                      <p className="text-xs text-gray-500">Thank you!</p>
                    </div>
                  </div>
                </div>
                {/* منطقة الشات */}
                <div className="lg:col-span-2 border rounded-xl flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <div className="flex justify-end mb-4">
                      <div className="bg-white p-3 rounded-lg rounded-tr-none shadow-sm max-w-[70%]">
                        <p className="text-sm">Hello, I have a question about the exam.</p>
                      </div>
                    </div>
                    <div className="flex justify-start mb-4">
                      <div className="bg-indigo-600 text-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[70%]">
                        <p className="text-sm">Sure, go ahead.</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white border-t">
                    <ReactQuill theme="snow" value={replyText} onChange={setReplyText} modules={quillModules} className="mb-4 h-24" />
                    <div className="flex justify-end mt-8">
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2">
                        <Send className="w-4 h-4" /> {language === 'ar' ? 'إرسال' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block font-medium mb-2">{language === 'ar' ? 'إرسال إلى' : 'Send To'}</label>
                  <div className="flex gap-4">
                    <select className="p-2 border rounded-lg">
                      <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                      {grades.map(g => <option key={g._id} value={g._id}>{g.name.ar}</option>)}
                    </select>
                     <select className="p-2 border rounded-lg">
                      <option value="all">{language === 'ar' ? 'كل التخصصات' : 'All Specializations'}</option>
                      {specializations.map(s => <option key={s._id} value={s._id}>{s.name.ar}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-medium mb-2 mt-4">{language === 'ar' ? 'نص التعميم' : 'Announcement Text'}</label>
                  <ReactQuill theme="snow" value={announcementText} onChange={setAnnouncementText} modules={quillModules} className="h-40 mb-12" />
                </div>
                <div className="flex justify-end">
                  <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2">
                    <Megaphone className="w-4 h-4" /> {language === 'ar' ? 'نشر التعميم' : 'Publish'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== نافذة إنشاء الامتحان (Modal) ========== */}
        {showExamModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold">{language === 'ar' ? 'إنشاء امتحان جديد' : 'Create New Exam'}</h2>
                <button onClick={() => setShowExamModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveExam} className="p-6 space-y-6">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'عنوان الامتحان' : 'Exam Title'}</label>
                  <input type="text" className="w-full border p-2 rounded" required value={examForm.title.ar} onChange={e => setExamForm({...examForm, title: {...examForm.title, ar: e.target.value}})} />
                </div>
                {/* ... باقي حقول الفورم يمكن إضافتها هنا بنفس الطريقة ... */}
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded">
                  {language === 'ar' ? 'تم دمج نموذج إنشاء الامتحان هنا.' : 'Exam creation form merged here.'}
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold">{language === 'ar' ? 'حفظ' : 'Save'}</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}