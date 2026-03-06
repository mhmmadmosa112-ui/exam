"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRoutes = void 0;
const express_1 = require("express");
const Exam_1 = require("../models/Exam");
const Subject_1 = require("../models/Subject");
const generative_ai_1 = require("@google/generative-ai");
const multer_1 = require("../config/multer");
const uuid_1 = require("../config/uuid");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdfParse = require('pdf-parse');
const router = (0, express_1.Router)();
exports.examRoutes = router;
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const adminAuth_1 = require("../middleware/adminAuth");
// ==================== CRUD للامتحانات ====================
// 1. جلب جميع الامتحانات (مع فلاتر)
router.get('/', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { subjectId, status, type, lang = 'ar' } = req.query;
        const filter = {};
        if (subjectId)
            filter.subjectId = subjectId;
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        const ctx = req.admin;
        if (ctx && ctx.role !== 'super') {
            filter.createdBy = ctx.email;
        }
        const exams = await Exam_1.Exam.find(filter)
            .populate('subjectId', 'name')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: exams });
    }
    catch (error) {
        console.error('❌ Error fetching exams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 2. جلب امتحان واحد
// 2. جلب امتحان واحد للتعديل
// ✅ استبدل دالة GET /:id بالكامل بهذا الكود (حوالي السطر 45-75)
// 2. جلب امتحان واحد للتعديل (نسخة مصلحة 100%)
router.get('/:id', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const ctx = req.admin;
        const baseFilter = { _id: id };
        if (ctx && ctx.role !== 'super') {
            baseFilter.createdBy = ctx.email;
        }
        const exam = await Exam_1.Exam.findOne(baseFilter)
            .populate('subjectId', 'name')
            .lean();
        if (!exam) {
            return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
        }
        // ✅ معالجة الأسئلة لضمان عودة جميع الحقول بالتنسيق الصحيح للـ Frontend
        const processedQuestions = exam.questions?.map((q) => {
            // 1. معالجة الخيارات
            const processedOptions = q.options?.map((opt) => ({
                id: opt.id || (0, uuid_1.generateId)(), // استخدام generateId المستورد في ملفك
                text: {
                    ar: opt.text?.ar || (typeof opt.text === 'string' ? opt.text : ''),
                    en: opt.text?.en || ''
                },
                isCorrect: opt.isCorrect === true
            })) || [];
            // 2. معالجة الإجابة الصحيحة (تأمين أنها رقم Index)
            let correctAnswerValue = -1;
            if (typeof q.correctAnswer === 'number') {
                correctAnswerValue = q.correctAnswer;
            }
            else if (typeof q.correctAnswer === 'string') {
                correctAnswerValue = parseInt(q.correctAnswer);
            }
            else if (q.correctAnswer && (q.correctAnswer.ar || q.correctAnswer.en)) {
                // إذا كانت مخزنة كنص، نبحث عن ترتيبها في الخيارات
                correctAnswerValue = processedOptions.findIndex((opt) => opt.isCorrect === true);
            }
            return {
                ...q,
                id: q.id || (0, uuid_1.generateId)(),
                text: {
                    ar: q.text?.ar || (typeof q.text === 'string' ? q.text : ''),
                    en: q.text?.en || ''
                },
                options: processedOptions,
                correctAnswer: correctAnswerValue,
                modelAnswer: q.modelAnswer || { ar: '', en: '' },
                keywords: q.keywords || [],
                points: q.points || 10,
                type: q.type || 'multiple-choice'
            };
        }) || [];
        const s = exam.settings || {};
        const processedExam = {
            ...exam,
            questions: processedQuestions,
            settings: {
                duration: s.duration ?? 30,
                totalPoints: s.totalPoints ?? 100,
                passingScore: s.passingScore ?? 50,
                shuffleQuestions: s.shuffleQuestions ?? false,
                shuffleOptions: s.shuffleOptions ?? true,
                showResults: s.showResults ?? 'after-publish',
                allowReview: s.allowReview ?? true,
                allowBackNavigation: true,
                timePerQuestion: false,
                timePerQuestionSeconds: 60,
                startDate: s.startDate,
                endDate: s.endDate
            }
        };
        res.json({ success: true, data: processedExam });
    }
    catch (error) {
        console.error('❌ Error fetching exam:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 3. إنشاء امتحان جديد (يدوي)
// ✅ في route POST /api/exams
router.post('/', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageExams'), async (req, res) => {
    try {
        const { title, subjectId, type, description, settings, questions, status, availability } = req.body;
        const userEmail = req.headers['x-user-email'];
        // تحقق من وجود المادة
        const subject = await Subject_1.Subject.findById(subjectId);
        if (!subject) {
            return res.status(400).json({ success: false, error: 'المادة غير موجودة' });
        }
        // تجهيز الأسئلة: ضبط الخيارات وتحديد correctAnswer كفهرس للأصناف الموضوعية
        const questionsWithIds = (questions || []).map((q) => {
            const id = q.id || (0, uuid_1.generateId)();
            const processedOptions = (q.options || []).map((opt) => ({
                id: opt.id || (0, uuid_1.generateId)(),
                text: {
                    ar: opt.text?.ar || (typeof opt.text === 'string' ? opt.text : '') || '',
                    en: opt.text?.en || ''
                },
                isCorrect: opt.isCorrect === true
            }));
            let correctAnswerValue = undefined;
            if (q.type === 'multiple-choice' || q.type === 'true-false') {
                if (typeof q.correctAnswer === 'number') {
                    correctAnswerValue = q.correctAnswer;
                }
                else if (typeof q.correctAnswer === 'string') {
                    correctAnswerValue = parseInt(q.correctAnswer);
                }
                else {
                    correctAnswerValue = processedOptions.findIndex((opt) => opt.isCorrect === true);
                }
                if (!Number.isFinite(correctAnswerValue)) {
                    correctAnswerValue = -1;
                }
            }
            return {
                id,
                type: q.type,
                text: {
                    ar: q.text?.ar || (typeof q.text === 'string' ? q.text : '') || '',
                    en: q.text?.en || ''
                },
                options: processedOptions,
                correctAnswer: (q.type === 'multiple-choice' || q.type === 'true-false')
                    ? correctAnswerValue
                    : (q.correctAnswer
                        ? { ar: q.correctAnswer?.ar || '', en: q.correctAnswer?.en || '' }
                        : undefined),
                points: q.points || 10,
                explanation: q.explanation || { ar: '', en: '' },
                keywords: q.keywords || []
            };
        });
        // حساب مجموع الدرجات
        const totalPoints = questionsWithIds.reduce((sum, q) => sum + (q.points || 1), 0);
        const exam = new Exam_1.Exam({
            title: { ar: title.ar, en: title.en },
            subjectId,
            type: type || 'custom',
            description: description ? { ar: description.ar, en: description.en } : undefined,
            settings: {
                ...settings,
                totalPoints
            },
            questions: questionsWithIds,
            status: status || 'draft', // ✅ استخدم من الـ Frontend
            availability: availability || {
                assignedTo: 'all',
                classIds: []
            },
            createdBy: userEmail,
            aiGenerated: false
        });
        await exam.save();
        res.status(201).json({
            success: true,
            message: 'تم إنشاء الامتحان بنجاح',
            data: exam
        });
    }
    catch (error) {
        console.error('❌ Error creating exam:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 4. تحديث امتحان
router.patch('/:id', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageExams'), async (req, res) => {
    try {
        const { title, description, settings, questions, status } = req.body;
        const update = {};
        if (title)
            update.title = { ar: title.ar, en: title.en };
        if (description)
            update.description = { ar: description.ar, en: description.en };
        if (settings)
            update.settings = settings;
        if (questions) {
            const processed = (questions || []).map((q) => {
                const id = q.id || (0, uuid_1.generateId)();
                const processedOptions = (q.options || []).map((opt) => ({
                    id: opt.id || (0, uuid_1.generateId)(),
                    text: {
                        ar: opt.text?.ar || (typeof opt.text === 'string' ? opt.text : '') || '',
                        en: opt.text?.en || ''
                    },
                    isCorrect: opt.isCorrect === true
                }));
                let correctAnswerValue = undefined;
                if (q.type === 'multiple-choice' || q.type === 'true-false') {
                    if (typeof q.correctAnswer === 'number') {
                        correctAnswerValue = q.correctAnswer;
                    }
                    else if (typeof q.correctAnswer === 'string') {
                        correctAnswerValue = parseInt(q.correctAnswer);
                    }
                    else {
                        correctAnswerValue = processedOptions.findIndex((opt) => opt.isCorrect === true);
                    }
                    if (!Number.isFinite(correctAnswerValue)) {
                        correctAnswerValue = -1;
                    }
                }
                return {
                    id,
                    type: q.type,
                    text: {
                        ar: q.text?.ar || (typeof q.text === 'string' ? q.text : '') || '',
                        en: q.text?.en || ''
                    },
                    options: processedOptions,
                    correctAnswer: (q.type === 'multiple-choice' || q.type === 'true-false')
                        ? correctAnswerValue
                        : (q.correctAnswer
                            ? { ar: q.correctAnswer?.ar || '', en: q.correctAnswer?.en || '' }
                            : undefined),
                    points: q.points || 10,
                    explanation: q.explanation || { ar: '', en: '' },
                    keywords: q.keywords || []
                };
            });
            update.questions = processed;
            update.settings = { ...(update.settings || {}), totalPoints: processed.reduce((sum, q) => sum + (q.points || 1), 0) };
        }
        if (status)
            update.status = status;
        const ctx = req.admin;
        const baseFilter = { _id: req.params.id };
        if (ctx && ctx.role !== 'super')
            baseFilter.createdBy = ctx.email;
        const updated = await Exam_1.Exam.findOneAndUpdate(baseFilter, { $set: update }, { new: true, runValidators: true }).populate('subjectId', 'name')
            .lean();
        if (!updated) {
            return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
        }
        res.json({ success: true, message: 'تم تحديث الامتحان بنجاح', data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// 5. حذف امتحان
router.delete('/:id', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageExams'), async (req, res) => {
    try {
        const ctx = req.admin;
        const baseFilter = { _id: req.params.id };
        if (ctx && ctx.role !== 'super')
            baseFilter.createdBy = ctx.email;
        const deleted = await Exam_1.Exam.findOneAndDelete(baseFilter);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
        }
        res.json({ success: true, message: 'تم حذف الامتحان بنجاح' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== ميزات الذكاء الاصطناعي ====================
// 6. رفع PDF وتوليد أسئلة بالذكاء الاصطناعي
router.post('/generate-from-pdf', adminAuth_1.adminAuth, multer_1.upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'يرجى رفع ملف PDF' });
        }
        const { questionCount = 10, questionTypes = ['multiple-choice', 'true-false'], totalPoints = 100, language = 'ar' } = req.body;
        const userEmail = req.headers['x-user-email'];
        // استخراج النص من PDF
        // استخراج النص من PDF - كود مضمون
        // ==================== استبدل من هنا ====================
        // استخراج النص من PDF
        const pdfPath = path_1.default.join(__dirname, '../../uploads', req.file.filename);
        const pdfBuffer = fs_1.default.readFileSync(pdfPath);
        // ✅ استخدام آمن لـ pdf-parse
        let pdfData;
        if (typeof pdfParse === 'function') {
            pdfData = await pdfParse(pdfBuffer);
        }
        else {
            pdfData = await pdfParse.default(pdfBuffer);
        }
        const pdfText = pdfData.text;
        fs_1.default.unlinkSync(pdfPath);
        // ✅ استقبل التعليمات المخصصة من المستخدم
        const { customInstructions = '' } = req.body;
        // توليد الأسئلة بـ Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // ✅ الـ prompt مع التعليمات المخصصة
        const prompt = `
أنت خبير في إنشاء الامتحانات التعليمية. قم بإنشاء ${questionCount} أسئلة بناءً على النص التالي:

${pdfText.substring(0, 15000)}

${customInstructions ? `\n📋 تعليمات إضافية من المستخدم:\n${customInstructions}` : ''}

المتطلبات:
- أنواع الأسئلة: ${questionTypes.join(', ')}
- اللغة: ${language === 'ar' ? 'العربية' : 'English'}
- الدرجة الكلية: ${totalPoints}
- وزع الدرجات بالتساوي على الأسئلة

أجب بصيغة JSON فقط بهذا الشكل:
{
  "questions": [
    {
      "type": "multiple-choice",
      "text": { "ar": "نص السؤال", "en": "Question text" },
      "options": [
        { "id": "1", "text": { "ar": "خيار 1", "en": "Option 1" }, "isCorrect": true },
        { "id": "2", "text": { "ar": "خيار 2", "en": "Option 2" }, "isCorrect": false }
      ],
      "points": 10,
      "explanation": { "ar": "شرح الإجابة", "en": "Explanation" },
      "keywords": ["كلمة1", "كلمة2"]
    }
  ]
}

لأسئلة الصح/خطأ:
{
  "type": "true-false",
  "text": { "ar": "العبارة", "en": "Statement" },
  "options": [
    { "id": "true", "text": { "ar": "صح", "en": "True" }, "isCorrect": true },
    { "id": "false", "text": { "ar": "خطأ", "en": "False" }, "isCorrect": false }
  ],
  "points": 10
}

للأسئلة الإنشائية:
{
  "type": "essay",
  "text": { "ar": "السؤال", "en": "Question" },
  "correctAnswer": { "ar": "الإجابة النموذجية", "en": "Model answer" },
  "points": 20,
  "keywords": ["كلمة1", "كلمة2", "كلمة3"]
}
`;
        // ==================== إلى هنا ====================
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        // تنظيف النص واستخراج JSON
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const examData = JSON.parse(text);
        // حفظ الامتحان في قاعدة البيانات
        const exam = new Exam_1.Exam({
            title: {
                ar: `امتحان مولد بالذكاء الاصطناعي - ${new Date().toLocaleDateString('ar-EG')}`,
                en: `AI Generated Exam - ${new Date().toLocaleDateString('en-US')}`
            },
            subjectId: req.body.subjectId,
            type: 'custom',
            settings: {
                duration: 30,
                totalPoints,
                passingScore: 50,
                shuffleQuestions: true,
                shuffleOptions: true,
                showResults: 'after-publish',
                allowReview: true
            },
            questions: examData.questions.map((q) => ({
                ...q,
                id: (0, uuid_1.generateId)()
            })),
            status: req.body.status || 'draft', // ← يستخدم الحالة من الـ Frontend
            createdBy: userEmail,
            aiGenerated: true,
            sourcePdf: req.file.originalname
        });
        await exam.save();
        res.json({
            success: true,
            message: 'تم توليد الامتحان بنجاح',
            data: exam,
            extractedText: pdfText.substring(0, 500) + '...' // عرض جزء من النص المستخرج
        });
    }
    catch (error) {
        console.error('❌ Error generating exam from PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.toString()
        });
    }
});
// 7. تصحيح سؤال إنشائي بالذكاء الاصطناعي
// 7. تصحيح سؤال إنشائي بالذكاء الاصطناعي - نسخة مضمونة
// 7. تصحيح سؤال إنشائي بالذكاء الاصطناعي - نسخة مضمونة ومصححة
router.post('/grade-essay', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { question, studentAnswer, modelAnswer, keywords, points, language = 'ar', examId, questionId } = req.body;
        // ✅ 1. التحقق من الحقول المطلوبة
        if (!question || !points) {
            return res.status(400).json({
                success: false,
                error: 'حقول مطلوبة ناقصة: question, points'
            });
        }
        // ✅ 1.1 جلب الإجابة النموذجية من قاعدة البيانات إذا توفرت معرفات الامتحان والسؤال
        let dbModelAnswer = null;
        if (examId && questionId) {
            try {
                const examDoc = await Exam_1.Exam.findById(examId).lean();
                const q = examDoc?.questions?.find((qq) => String(qq.id) === String(questionId));
                if (q) {
                    dbModelAnswer = q.modelAnswer || q.correctAnswer || null;
                }
            }
            catch (e) {
                // تجاهل الخطأ، سنستخدم modelAnswer القادم من الطلب
            }
        }
        const effectiveModelAnswer = dbModelAnswer || modelAnswer || { ar: '', en: '' };
        // ✅ 2. التحقق من الإجابة الفارغة ← درجة 0 فوراً
        if (!studentAnswer || !studentAnswer.trim()) {
            return res.json({
                success: true,
                data: {
                    score: 0, // ✅ إجابة فارغة = درجة 0
                    feedback: {
                        ar: 'الإجابة فارغة. يرجى كتابة رد على السؤال.',
                        en: 'The answer is empty. Please write a response to the question.'
                    },
                    strengths: [],
                    weaknesses: ['إجابة فارغة'],
                    missingKeywords: keywords || []
                }
            });
        }
        // ✅ 3. التحقق من مفتاح API
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY غير موجود في .env');
            return res.status(500).json({
                success: false,
                error: 'مفتاح الذكاء الاصطناعي غير مُهيأ'
            });
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // ✅ 4. تحسين الـ prompt للتحقق من جودة الإجابة - صارم جداً ويقارن بالإجابة النموذجية
        const prompt = `
أنت مصحح امتحانات صارم وعادل. قم بتحليل الإجابة الإنشائية التالية بدقة:

📋 السؤال: ${typeof question === 'object' ? question[language] || question.ar : question}

🎯 الإجابة النموذجية المرجعية: ${typeof effectiveModelAnswer === 'object' ? (effectiveModelAnswer[language] || effectiveModelAnswer.ar) : effectiveModelAnswer || 'غير متوفرة'}

🔑 الكلمات المفتاحية المتوقعة: ${keywords?.join(', ') || 'لا توجد'}

📊 الدرجة الكاملة: ${points}

✍️ إجابة الطالب:
"""
${studentAnswer.trim()}
"""

⚠️ معايير التصحيح الصارمة جداً:
1) التطابق الدلالي مع الإجابة النموذجية شرط أساسي. إذا غابت النقاط الجوهرية في الإجابة النموذجية، الدرجة = 0.
2) الكلمات المفتاحية مطلوبة: 
   - لا كلمات مفتاحية مطابقة ⇒ الدرجة = 0.
   - كلمات مفتاحية قليلة ⇒ خصم كبير (≥70%) حسب أهميتها.
3) إجابة غير ذات صلة أو هراء أو حشو أو مخالفة للسؤال ⇒ الدرجة = 0.
4) نسخ السؤال أو جمل عامة بدون مضمون ⇒ الدرجة = 0.
5) الطول:
   - أقل من 20 كلمة ⇒ حد أقصى 20% من ${points}.
6) المحتوى:
   - أخطاء علمية جوهرية ⇒ الدرجة = 0.
7) التجانس:
   - إن كانت الإجابة جزئية لكنها صحيحة وتشمل بعض النقاط الأساسية والكلمات المفتاحية ⇒ امنح درجة جزئية متناسبة.

أجب بصيغة JSON فقط (بدون أي نص قبل أو بعد):
{
  "score": <رقم بين 0 و ${points}>,
  "feedback": {
    "ar": "تعليق بالعربية",
    "en": "Feedback in English"
  },
  "isRelevant": true/false,
  "wordCount": <عدد الكلمات>,
  "matchedKeywords": ["كلمة1", "كلمة2"],
  "missingKeywords": ["كلمة3"],
  "reasoning": "سبب منطقي قصير للدرجة"
}
`;
        console.log('🤖 Sending grading request to Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();
        // ✅ 5. تنظيف النص لاستخراج JSON فقط
        text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        const grading = JSON.parse(text);
        // ✅ 6. تحقق إضافي من صحة النتيجة
        let finalScore = grading.score;
        // إذا لم يكن الرقم صالحاً
        if (typeof finalScore !== 'number' || isNaN(finalScore)) {
            finalScore = 0;
        }
        // إذا كانت الدرجة خارج النطاق
        if (finalScore < 0)
            finalScore = 0;
        if (finalScore > points)
            finalScore = points;
        // ✅ 7. تحقق من صلة الإجابة بالسؤال (إذا أرجعها الـ AI)
        if (grading.isRelevant === false) {
            finalScore = 0; // إجابة غير ذات صلة ← درجة 0
        }
        // ✅ 8. تحقق من عدد الكلمات (إذا كان قليلاً جداً)
        if (grading.wordCount && grading.wordCount < 20 && finalScore > points * 0.3) {
            finalScore = Math.round(points * 0.3); // حد أقصى 30% للإجابات القصيرة
        }
        res.json({
            success: true,
            message: 'تم التصحيح بنجاح',
            data: {
                ...grading,
                score: finalScore // ✅ استخدام الدرجة المصححة
            }
        });
    }
    catch (error) {
        console.error('❌ Error grading essay:', error);
        // ✅ Fallback: مقارنة بسيطة بالكلمات المفتاحية في حال فشل الـ AI
        try {
            const { studentAnswer, keywords, points } = req.body;
            if (keywords && keywords.length > 0) {
                const studentAnswerLower = studentAnswer?.toLowerCase() || '';
                const matchedKeywords = keywords.filter((kw) => studentAnswerLower.includes(kw.toLowerCase()));
                const matchRatio = matchedKeywords.length / keywords.length;
                const fallbackScore = Math.round((matchRatio * (points || 10)));
                return res.json({
                    success: true,
                    message: 'تم التصحيح بالطريقة البديلة',
                    data: {
                        score: fallbackScore,
                        feedback: {
                            ar: `تم العثور على ${matchedKeywords.length} من ${keywords.length} كلمات مفتاحية`,
                            en: `Found ${matchedKeywords.length} of ${keywords.length} keywords`
                        },
                        matchedKeywords,
                        missingKeywords: keywords.filter((kw) => !studentAnswerLower.includes(kw.toLowerCase())),
                        method: 'keyword-fallback'
                    }
                });
            }
        }
        catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
        }
        // ✅ إذا فشل كل شيء ← درجة 0 مع رسالة واضحة
        res.status(200).json({
            success: true,
            message: 'فشل التصحيح - درجة افتراضية',
            data: {
                score: 0, // ✅ درجة 0 بدلاً من 50% ← أكثر عدلاً
                feedback: {
                    ar: 'عذراً، حدث خطأ في خدمة التصحيح. يرجى إعادة المحاولة أو مراجعة المعلم.',
                    en: 'Sorry, grading service error. Please retry or contact your teacher.'
                },
                strengths: [],
                weaknesses: ['لم يتم التحليل بسبب خطأ تقني'],
                missingKeywords: [],
                method: 'error-fallback'
            }
        });
    }
});
// 8. إعادة توليد أسئلة امتحان موجود بالـ AI
router.post('/:id/regenerate-questions', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const exam = await Exam_1.Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
        }
        const { questionCount, questionTypes } = req.body;
        // تجميع نص الأسئلة الحالية كـ context
        const contextText = exam.questions.map((q) => q.text.ar).join(' | ');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `
أعد توليد ${questionCount || exam.questions.length} أسئلة امتحان مشابهة للأسئلة التالية:

${contextText.substring(0, 10000)}

أنواع الأسئلة المطلوبة: ${questionTypes?.join(', ') || 'multiple-choice, true-false'}

أجب بصيغة JSON كما في endpoint توليد الامتحانات.
`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const newQuestions = JSON.parse(text);
        res.json({
            success: true,
            message: 'تم إعادة توليد الأسئلة',
            data: { questions: newQuestions.questions }
        });
    }
    catch (error) {
        console.error('❌ Error regenerating questions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
