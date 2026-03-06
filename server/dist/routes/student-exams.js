"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRoutes = void 0;
const express_1 = require("express");
const Exam_1 = require("../models/Exam"); // ✅ استيراد مودل الامتحان
const ExamResult_1 = require("../models/ExamResult");
const CheatLog_1 = require("../models/CheatLog");
const router = (0, express_1.Router)();
exports.examRoutes = router;
// ✅ Middleware للتحقق من تسجيل الدخول (بدون تحقق من أدمن)
const studentAuth = (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    const userId = req.headers['x-user-id'];
    if (!userEmail) {
        return res.status(401).json({
            success: false,
            error: 'غير مسجل الدخول'
        });
    }
    next();
};
// ✅ 1. جلب امتحان واحد للطالب بـ ID (الرابط: /api/student-exams/:id)
router.get('/:id', studentAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.headers['x-user-email'];
        const userId = req.headers['x-user-id'] || ''; // اختياري إذا أرسل من العميل
        const { BlockedUser } = await Promise.resolve().then(() => __importStar(require('../models/BlockedUser')));
        if (userId) {
            const blocked = await BlockedUser.findOne({ userId, userEmail }).lean();
            if (blocked) {
                return res.status(403).json({ success: false, error: 'Account is blocked' });
            }
        }
        // جلب الامتحان من قاعدة البيانات
        const exam = await Exam_1.Exam.findById(id)
            .populate('subjectId', 'name code')
            .lean();
        if (!exam) {
            return res.status(404).json({
                success: false,
                error: 'الامتحان غير موجود'
            });
        }
        // ✅ تحقق من أن الامتحان متاح للطالب
        const now = new Date();
        const isPublished = exam.status === 'published' || exam.status === 'active';
        // تحقق من التواريخ
        const isWithinDates = !exam.availability?.startDate ||
            (new Date(exam.availability.startDate) <= now);
        const isNotExpired = !exam.availability?.endDate ||
            (new Date(exam.availability.endDate) >= now);
        // تحقق من التخصيص (جميع الطلاب أو فئة محددة)
        const isAssigned = exam.availability?.assignedTo === 'all';
        if (!isPublished || !isWithinDates || !isNotExpired || !isAssigned) {
            return res.status(403).json({
                success: false,
                error: 'الامتحان غير متاح لك حالياً'
            });
        }
        // ✅ قاعدة محاولة واحدة إذا allowRetake=false
        const allowRetake = exam.settings?.allowRetake === true;
        if (!allowRetake) {
            const existing = await ExamResult_1.ExamResult.findOne({ examId: String(id), userEmail }).lean();
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'You have already submitted this exam'
                });
            }
        }
        // ✅ إخفاء الإجابات الصحيحة قبل الإرسال للطالب (أمان)
        const sanitizedExam = {
            ...exam,
            questions: exam.questions.map((q) => ({
                id: q.id,
                type: q.type,
                text: q.text,
                options: q.options?.map((opt) => ({
                    id: opt.id,
                    text: opt.text
                    // ❌ لا نرسل isCorrect للطالب!
                })),
                points: q.points
                // ❌ لا نرسل correctAnswer أو explanation
            }))
        };
        res.json({ success: true, data: sanitizedExam });
    }
    catch (error) {
        console.error('❌ Error fetching exam for student:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ✅ 2. جلب قائمة الامتحانات المتاحة للطالب (اختياري)
router.get('/', studentAuth, async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const now = new Date();
        // جلب الامتحانات المنشورة/النشطة والمتاحة للجميع
        const exams = await Exam_1.Exam.find({
            status: { $in: ['published', 'active'] },
            'availability.assignedTo': 'all',
            $and: [
                { $or: [
                        { 'availability.startDate': { $lte: now } },
                        { 'availability.startDate': { $exists: false } }
                    ] },
                { $or: [
                        { 'availability.endDate': { $gte: now } },
                        { 'availability.endDate': { $exists: false } }
                    ] }
            ]
        })
            .populate('subjectId', 'name code')
            .sort({ createdAt: -1 })
            .lean();
        // إخفاء البيانات الحساسة
        const sanitizedExams = exams.map((exam) => ({
            ...exam,
            questions: exam.questions.map((q) => ({
                id: q.id,
                type: q.type,
                text: q.text,
                points: q.points
            }))
        }));
        res.json({ success: true, data: sanitizedExams });
    }
    catch (error) {
        console.error('❌ Error fetching exams for student:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ====================保留 الـ Routes القديمة (للتوافق) ====================
// بيانات تجريبية (للتطوير فقط - يمكن حذفها لاحقاً)
const mockExamData = {
    topic: 'الذكاء الاصطناعي والتعلم الآلي',
    duration: 30,
    questions: [
        { id: 1, question: 'ما هو التعلم الآلي؟', options: ['فرع من الذكاء الاصطناعي', 'لغة برمجة', 'قاعدة بيانات', 'جهاز حاسوب'], correctAnswer: 0 }
    ]
};
// توليد أسئلة (mock) - يمكن حذفه لاحقاً
router.post('/generate', async (req, res) => {
    try {
        const { topic, questionCount = 10, duration = 30 } = req.body;
        const questions = mockExamData.questions.slice(0, questionCount);
        res.json({
            success: true,
            useMock: true,
            message: 'وضع التطوير: أسئلة تجريبية',
            data: { topic: topic || mockExamData.topic, duration, questions }
        });
    }
    catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// حفظ نتيجة الامتحان
// ✅ تأكد أن endpoint التسليم يحفظ في ExamResult collection:
// ✅ حفظ نتيجة الامتحان
router.post('/submit', async (req, res) => {
    try {
        const { examId, userId, userEmail, userName, examTopic, answers, essayAnswers, duration, timeSpent, language = 'ar' } = req.body;
        const { ExamResult } = await Promise.resolve().then(() => __importStar(require('../models/ExamResult')));
        if (!examId || !userId) {
            return res.status(400).json({ success: false, error: 'examId و userId مطلوبة' });
        }
        const exam = await Exam_1.Exam.findById(examId).lean();
        if (!exam) {
            return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
        }
        // ✅ منع التسليم أكثر من مرة إذا allowRetake=false
        if (exam.settings?.allowRetake !== true) {
            const exists = await ExamResult.findOne({ examId: String(examId), userEmail }).lean();
            if (exists) {
                return res.status(409).json({ success: false, error: 'You have already submitted this exam' });
            }
        }
        const processedAnswers = Array.isArray(answers)
            ? answers.map((a) => {
                if (a === undefined || a === null)
                    return -1;
                const num = typeof a === 'string' ? parseInt(a) : Number(a);
                return isNaN(num) ? -1 : num;
            })
            : [];
        const processedQuestions = (exam.questions || []).map((q) => {
            const correctIdx = Array.isArray(q.options)
                ? q.options.findIndex((opt) => opt?.isCorrect === true)
                : -1;
            return {
                id: String(q.id || ''),
                question: q.text?.[language] || q.text?.ar || q.text?.en || '',
                options: (q.options || []).map((opt) => typeof opt === 'string' ? opt : (opt?.text?.[language] || opt?.text?.ar || opt?.text?.en || '')),
                correctAnswer: correctIdx,
                points: q.points || 1,
                type: q.type || 'multiple-choice'
            };
        });
        let earnedPoints = 0;
        let totalPoints = 0;
        processedQuestions.forEach((q, idx) => {
            if (q.type === 'multiple-choice' || q.type === 'true-false') {
                totalPoints += q.points || 1;
                const studentChoice = processedAnswers[idx];
                if (typeof studentChoice === 'number' && studentChoice >= 0 && studentChoice === q.correctAnswer) {
                    earnedPoints += q.points || 1;
                }
            }
        });
        const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        const langKey = language === 'en' ? 'en' : 'ar';
        const resultDoc = new ExamResult({
            examId: String(examId),
            userId,
            userEmail: userEmail || 'user@example.com',
            userName: userName || 'طالب',
            examTopic: examTopic || (exam?.title?.[langKey] || exam?.title?.ar) || 'امتحان',
            questions: processedQuestions,
            answers: processedAnswers,
            essayAnswers: Array.isArray(essayAnswers) ? essayAnswers : [],
            score: finalScore,
            duration: duration || exam.settings?.duration || 30,
            timeSpent: timeSpent || 0,
            submittedAt: new Date(),
            isReviewed: false
        });
        await resultDoc.save();
        res.json({
            success: true,
            message: 'تم حفظ النتيجة بنجاح',
            data: {
                resultId: resultDoc._id,
                userId,
                score: finalScore,
                submittedAt: resultDoc.submittedAt
            }
        });
    }
    catch (error) {
        console.error('❌ Error saving exam result:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'فشل حفظ النتيجة'
        });
    }
});
// ✅ تسجيل سلوك الغش/الخروج
router.post('/cheat-log', studentAuth, async (req, res) => {
    try {
        const { examId, userId, event, details } = req.body;
        const userEmail = req.headers['x-user-email'];
        if (!examId || !userId || !event) {
            return res.status(400).json({ success: false, error: 'examId, userId, event مطلوبة' });
        }
        const doc = new CheatLog_1.CheatLog({
            examId: String(examId),
            userId: String(userId),
            userEmail,
            event,
            details
        });
        await doc.save();
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message || 'فشل التسجيل' });
    }
});
// ✅ طلب إتاحة إعادة المحاولة
router.post('/retake-request', studentAuth, async (req, res) => {
    try {
        const { examId, userId, reason } = req.body;
        const userEmail = req.headers['x-user-email'];
        if (!examId || !userId) {
            return res.status(400).json({ success: false, error: 'examId,userId مطلوبة' });
        }
        const { RetakeRequest } = await Promise.resolve().then(() => __importStar(require('../models/RetakeRequest')));
        const doc = await RetakeRequest.findOneAndUpdate({ examId: String(examId), userId: String(userId) }, { $set: { userEmail, status: 'pending', reason: reason || '' } }, { upsert: true, new: true }).lean();
        res.json({ success: true, data: doc });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message || 'فشل إنشاء الطلب' });
    }
});
// ✅ أضف هذا في نهاية الملف قبل export
// جلب سجل امتحانات طالب معين
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, page = 1 } = req.query;
        const { ExamResult } = await Promise.resolve().then(() => __importStar(require('../models/ExamResult')));
        const results = await ExamResult.find({ userId })
            .sort({ submittedAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .select('-questions -answers') // لا نرجع الأسئلة والإجابات للتقليل من حجم البيانات
            .lean();
        const total = await ExamResult.countDocuments({ userId });
        res.json({
            success: true,
            data: {
                results,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching exam history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// جلب سجل امتحانات الطالب
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, page = 1 } = req.query;
        const { ExamResult } = await Promise.resolve().then(() => __importStar(require('../models/ExamResult')));
        const results = await ExamResult.find({ userId })
            .sort({ submittedAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .select('-questions -answers')
            .lean();
        const total = await ExamResult.countDocuments({ userId });
        res.json({
            success: true,
            data: {
                results,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// جلب تفاصيل نتيجة امتحان
router.get('/result/:resultId', async (req, res) => {
    try {
        const { resultId } = req.params;
        const { ExamResult } = await Promise.resolve().then(() => __importStar(require('../models/ExamResult')));
        const result = await ExamResult.findById(resultId).lean();
        if (!result) {
            return res.status(404).json({ success: false, error: 'لم يتم العثور على النتيجة' });
        }
        // ✅ لا تنشر التفاصيل الحساسة إلا إذا تم نشرها من الأدمن
        if (!result.isPublished) {
            return res.json({
                success: true,
                data: {
                    _id: result._id,
                    examId: result.examId,
                    examTopic: result.examTopic,
                    score: result.score,
                    submittedAt: result.submittedAt,
                    isReviewed: result.isReviewed,
                    // بدون adminNotes والأسئلة والإجابات
                }
            });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        console.error('❌ Error fetching result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
