'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useLanguage } from '@/context/LanguageContext';
import { Clock, ChevronLeft, ChevronRight, CheckCircle, Award, AlertCircle, Loader2, Lock } from 'lucide-react';
import Header from '@/components/Header';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { useExamSocket } from './useExamSocket';


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

interface IOption {
  id: string;
  text: { ar: string; en: string };
  isCorrect?: boolean;
}

// ✅ Interface for Question Groups from server
interface QuestionGroup {
  id: string;
  title: { ar: string; en: string };
  requiredCount: number;
  questionIds: string[];
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
  questionGroups?: QuestionGroup[];
  status: 'draft' | 'scheduled' | 'active' | 'closed' | 'published';
  isReviewed?: boolean;
}

function ExamPageContent() {
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
  const [isLocked, setIsLocked] = useState(false);

  // ✅ State for Conditional Groups
  const [groupAnswerStatus, setGroupAnswerStatus] = useState<Record<string, { answeredIds: Set<string> }>>({});

  // Proctoring State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

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
          // ✅ تهيئة حالة المجموعات
          const initialGroupStatus: Record<string, { answeredIds: Set<string> }> = {};
          if (data.data.questionGroups) {
            data.data.questionGroups.forEach((group: QuestionGroup) => {
              initialGroupStatus[group.id] = { answeredIds: new Set() };
            });
          }
          setGroupAnswerStatus(initialGroupStatus);
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

  // ✅ Real-time Exam Commander Hook
  const { socket: commanderSocket } = useExamSocket({
    examId: examId || '',
    studentId: user?.email || '',
    onTimeExtended: (minutes: number) => {
      setTimeRemaining(prev => prev + (minutes * 60));
      const msg = language === 'ar' 
        ? `📢 تم تمديد وقت الامتحان ${minutes} دقيقة` 
        : `📢 Exam time extended by ${minutes} minutes`;
      setNotifications(prev => [...prev, msg]);
      // Optional: TTS
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(msg);
        window.speechSynthesis.speak(utterance);
      }
      setTimeout(() => setNotifications(prev => prev.slice(1)), 5000);
    },
    onInstantLock: () => {
      alert(language === 'ar' ? 'تم إنهاء الامتحان من قبل المسؤول.' : 'Exam ended by administrator.');
      submitExam();
    },
    onClarification: (message: string) => {
      setNotifications(prev => [...prev, `🔔 ${message}`]);
      setTimeout(() => setNotifications(prev => prev.slice(1)), 10000);
    },
    onExamStart: () => {
      if (!examStarted) {
        startExam();
      }
    }
  });

  // ✅ مراقبة الغش بالخروج من التبويب أو فقدان التركيز
  useEffect(() => {
    if (!exam || !user || !examStarted || examSubmitted || submitting) return;
    
    // Bypass if camera is initializing or exam hasn't fully started logic
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
      // Skip if just starting (e.g. browser permission dialogs)
      if (!examStarted) return; 
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
  }, [exam, user, language, examStarted, examSubmitted, submitting]);

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

  // ✅ Anti-Tamper Enforcement
  const handleStreamTampering = useCallback(() => {
    setIsLocked(true);
    if (socket && user) {
      socket.emit('student-tampered-with-stream', { 
        studentId: user.email, 
        examId: exam?._id 
      });
    }
  }, [socket, user, exam]);

  const monitorTrack = useCallback((track: MediaStreamTrack) => {
    track.onended = () => {
      console.warn('Stream track ended unexpectedly');
      handleStreamTampering();
    };
    // Also listen for inactive state if browser supports it differently
    // track.onmute = ... could be added but might be too sensitive for network blips
  }, [handleStreamTampering]);

  const startScreenshotFallback = useCallback((camStream: MediaStream, screenStream: MediaStream, sock: Socket, fromId: string) => {
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);

    const camVideo = document.createElement('video');
    camVideo.srcObject = camStream;
    camVideo.play();

    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    screenVideo.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    fallbackIntervalRef.current = setInterval(() => {
        if (!ctx) return;
        canvas.width = 320; canvas.height = 180;
        ctx.drawImage(camVideo, 0, 0, 320, 180);
        const cameraDataUrl = canvas.toDataURL('image/jpeg', 0.5);
        ctx.drawImage(screenVideo, 0, 0, 320, 180);
        const screenDataUrl = canvas.toDataURL('image/jpeg', 0.5);
        sock.emit('screenshot-from-student', { from: fromId, camera: cameraDataUrl, screen: screenDataUrl });
    }, 5000);
  }, []);

  // ✅ دالة بدء الامتحان ← مهمة جداً لتشغيل العداد
  const startExam = useCallback(async () => {
    if (!examStarted && exam && user) {
      setExamStarted(true);
      
      // Phase 2: Automated Capture & Streaming
      try {
        // Simultaneous Capture
        const [cameraStream, screenStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
          navigator.mediaDevices.getDisplayMedia({ video: true })
        ]);

        // Audio Injection: Add mic audio to screen stream if missing
        const audioTrack = cameraStream.getAudioTracks()[0];
        if (audioTrack) {
           // Clone to avoid track ending issues if one stream stops
           screenStream.addTrack(audioTrack.clone());
        }

        // Active Monitoring
        cameraStream.getTracks().forEach(monitorTrack);
        screenStream.getTracks().forEach(monitorTrack);
        if (audioTrack) monitorTrack(audioTrack);

        // Reuse the socket from the hook if available, otherwise create new (though hook creates one)
        // Ideally we use the one from useExamSocket, but for WebRTC we might need the specific instance logic
        // Let's use the one created here for WebRTC specifically to avoid conflict with the hook's logic
        const newSocket = commanderSocket || io('http://localhost:3001/monitoring');
        setSocket(newSocket); // Keep this for local state usage

        let localPeer: Peer.Instance | null = null;

        newSocket.on('connect', () => {
            console.log('[Socket.IO] Student connected:', newSocket.id);
            newSocket.emit('join-exam', { studentId: user.email!, examId: exam._id });
        });

        // Listen for an offer from a specific admin
        newSocket.on('admin-webrtc-signal', (payload: { signal: any, fromAdminSocketId: string }) => {
            // Prevent creating multiple peers for one session
            if (localPeer) {
                console.log('[WebRTC] Peer connection already exists or is being established.');
                return;
            }

            const p = new (Peer as any)({
                initiator: false, // Student is not the initiator
                trickle: false,
            });
            localPeer = p;
            setPeer(p);

            // Accept the admin's offer signal
            p.signal(payload.signal);

            // When our peer generates an answer signal, send it back to the specific admin
            p.on('signal', (answerSignal: any) => {
                newSocket.emit('student-webrtc-signal', { signal: answerSignal, toAdminSocketId: payload.fromAdminSocketId });
            });

            p.on('connect', () => {
                console.log('[WebRTC] Connected to proctor!');
                if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
                p.addStream(cameraStream);
                p.addStream(screenStream);
            });

            const startFallback = () => startScreenshotFallback(cameraStream, screenStream, newSocket, newSocket.id!);
            p.on('error', (err: any) => { console.error('[WebRTC] P2P Error, starting fallback', err); startFallback(); });
            p.on('close', () => { console.log('[WebRTC] P2P Closed, starting fallback'); startFallback(); });
        });

      } catch (err) {
        console.error("Could not get media streams", err);
        setError("Camera and Screen sharing are required to start the exam.");
        setExamStarted(false); // Revert start
      }
    }
  }, [examStarted, exam, user, startScreenshotFallback, commanderSocket, monitorTrack]);

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

  // ✅ Create a map for quick question -> group lookup
  const questionIdToGroupIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!exam?.questionGroups) return map;
    for (const group of exam.questionGroups) {
      for (const qId of group.questionIds) {
        map.set(qId, group.id);
      }
    }
    return map;
  }, [exam?.questionGroups]);

  // ✅ Helper to update group answer status
  const updateGroupStatus = (questionId: string, isAnswered: boolean) => {
    const groupId = questionIdToGroupIdMap.get(questionId);
    if (groupId) {
      setGroupAnswerStatus(prev => {
        const newStatus = { ...prev };
        const answeredIds = new Set(newStatus[groupId].answeredIds);
        if (isAnswered) {
          answeredIds.add(questionId);
        } else {
          answeredIds.delete(questionId);
        }
        newStatus[groupId] = { answeredIds };
        return newStatus;
      });
    }
  };

  // ✅ اختيار إجابة للأسئلة الموضوعية ← يبدأ الامتحان تلقائياً عند أول إجابة
  const selectAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    // ✅ بدء الامتحان عند أول إجابة
    if (!examStarted) {
      startExam();
    }

    const questionId = exam?.questions[questionIndex]?.id;
    if (!questionId) return;

    setStudentAnswers(prev => {
      const newAnswers = [...prev];
      const isClearing = newAnswers[questionIndex] === optionIndex;
      newAnswers[questionIndex] = isClearing ? undefined : optionIndex;
      
      // Update group status
      updateGroupStatus(questionId, !isClearing);

      return newAnswers;
    });
  }, [examStarted, startExam, exam?.questions]);

  // ✅ حفظ إجابة إنشائية ← يبدأ الامتحان تلقائياً عند أول كتابة
  const saveEssayAnswer = useCallback((questionIndex: number, answer: string) => {
    if (!examStarted) {
      startExam();
    }

    const questionId = exam?.questions[questionIndex]?.id;
    if (!questionId) return;

    updateGroupStatus(questionId, answer.trim() !== '');

    setEssayAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = answer;
      return newAnswers;
    });
  }, [examStarted, startExam, exam?.questions]);

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

    // Cleanup proctoring connections
    if (peer) peer.destroy();
    if (socket) socket.close();
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);


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
        userEmail: user.email!,
        userName: user.displayName || 'طالب',
        examTopic: exam.title?.[language] || exam.title?.ar,
        
        questions: exam.questions.map((q: Question, idx: number) => ({
  id: String(idx),
  question: q.text?.[language] || q.text?.ar,
  options: q.options?.map((opt: any) => 
    opt.text?.[language] || opt.text?.ar || ''
  ) || [],
  correctAnswer: q.options?.findIndex((opt: any) => opt.isCorrect === true) ?? -1,
  points: q.points || 1,
  type: q.type || 'multiple-choice'
})),
        
        // ✅ إجابات الطالب: غير المجابة تُرسل كـ null
        answers: studentAnswers.map(a => {
          if (a === undefined || a === null) return null;
          const num = typeof a === 'string' ? parseInt(a) : Number(a);
          return isNaN(num) ? null : num;
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

  // ✅ FIX: Move Hooks and derived state BEFORE any conditional returns
  const question = exam?.questions?.[currentQuestionIndex];
  const isLastQuestion = exam?.questions ? currentQuestionIndex === exam.questions.length - 1 : false;
  const canGoBack = currentQuestionIndex > 0 && exam?.settings?.allowBackNavigation;

  const questionGroupId = question ? questionIdToGroupIdMap.get(question.id) : undefined;
  const groupInfo = (questionGroupId && exam?.questionGroups) ? exam.questionGroups.find(g => g.id === questionGroupId) : undefined;

  // ✅ Logic to determine if the current question should be locked
  const isQuestionLocked = useMemo(() => {
    if (!question || !groupInfo) return false; // Not in a group, not locked
    const status = groupAnswerStatus[groupInfo.id];
    if (!status) return false;
    const isAnswered = status.answeredIds.has(question.id);
    if (isAnswered) return false; // Can always edit an answered question
    return status.answeredIds.size >= groupInfo.requiredCount;
  }, [question, groupInfo, groupAnswerStatus]);

  // ✅ Lock Screen Overlay
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-red-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <Lock className="w-24 h-24 mb-6 animate-pulse" />
        <h1 className="text-4xl font-bold mb-4">Security Violation</h1>
        <p className="text-xl mb-8 max-w-2xl">
          Screen or Camera sharing was interrupted. Access to the exam is denied until streams are re-enabled.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-8 py-4 bg-white text-red-900 font-bold rounded-xl hover:bg-gray-100 transition-colors"
        >
          Re-enable Streams & Resume
        </button>
      </div>
    );
  }

  // شاشة التحميل
  if (loading || loadingExam) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center">
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
        <main className="min-h-screen bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
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
        <main className="min-h-screen bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
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
  if (!question) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-linear-to-br from-slate-200 via-slate-300 to-indigo-200 p-4" dir={dir}>
        <div className="max-w-3xl mx-auto">
          
          {/* Notifications Toast */}
          <div className="fixed top-20 right-4 z-50 space-y-2">
            {notifications.map((note, idx) => (
              <div key={idx} className="bg-blue-600 text-white px-6 py-4 rounded-lg shadow-lg animate-bounce">{note}</div>
            ))}
          </div>
          
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

            {/* ✅ Group Information Badge */}
            {groupInfo && (
              <div className="mb-4 text-center">
                <div className="inline-block bg-purple-100 text-purple-800 text-sm font-bold px-4 py-2 rounded-full">
                  {getText(groupInfo.title)}: {language === 'ar' ? `أجب على ${groupInfo.requiredCount} من ${groupInfo.questionIds.length}` : `Answer ${groupInfo.requiredCount} of ${groupInfo.questionIds.length}`}
                  <span className="ml-2 font-mono">({groupAnswerStatus[groupInfo.id]?.answeredIds.size || 0}/{groupInfo.requiredCount})</span>
                </div>
              </div>
            )}

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
                    disabled={isQuestionLocked}
                    onClick={() => selectAnswer(currentQuestionIndex, optIndex)}
                    className={`w-full p-4 rounded-xl border-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} transition-all duration-200 ${
                      studentAnswers[currentQuestionIndex] === optIndex
                        ? 'border-indigo-600 bg-indigo-100 text-indigo-900 shadow-md'
                        : isQuestionLocked ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 bg-white'
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
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
                  disabled={isQuestionLocked}
                  value={essayAnswers[currentQuestionIndex] || ''}
                  onChange={(e) => saveEssayAnswer(currentQuestionIndex, e.target.value)}
                  className={`w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500 ${dir === 'rtl' ? 'text-right' : 'text-left'} ${isQuestionLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ExamPageContent />
    </Suspense>
  );
}
