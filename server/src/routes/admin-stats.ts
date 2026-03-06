import { Router, Request, Response } from 'express';
import { Exam } from '../models/Exam';
import { ExamResult } from '../models/ExamResult';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// ✅ 1. جلب الإحصائيات العامة
// 2. جلب امتحان واحد للتعديل - مسار محدد لتفادي التعارض مع /results
router.get('/exams/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id)
      .populate('subjectId', 'name')
      .lean();
    
    if (!exam) {
      return res.status(404).json({ success: false, error: 'الامتحان غير موجود' });
    }
    
    // ✅ معالجة الأسئلة لضمان عودة جميع الحقول
    const processedExam = {
      ...exam,
      questions: exam.questions?.map((q: any) => ({
        ...q,
        // ✅ التأكد من أن options تحتوي على جميع الحقول
        options: q.options?.map((opt: any) => ({
          id: opt.id,
          text: {
            ar: opt.text?.ar || opt.text || '',
            en: opt.text?.en || opt.text || ''
          },
          isCorrect: opt.isCorrect === true  // ✅ تحويلها لـ boolean
        })) || [],
        // ✅ التأكد من أن modelAnswer موجود
        modelAnswer: q.modelAnswer || { ar: '', en: '' },
        keywords: q.keywords || [],
        // ✅ تحويل correctAnswer لـ number إذا كان object
        correctAnswer: typeof q.correctAnswer === 'object' 
          ? q.options?.findIndex((opt: any) => opt.isCorrect === true) ?? -1
          : typeof q.correctAnswer === 'string'
            ? parseInt(q.correctAnswer)
            : q.correctAnswer
      })) || []
    };
    
    res.json({ success: true, data: processedExam });
  } catch (error: any) {
    console.error('❌ Error fetching exam:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ تحديث endpoint جلب النتائج في server/src/routes/admin-stats.ts
router.get('/results', adminAuth, async (req, res) => {
  try {
    // استخراج الفلاتر من query params
    const { examId, search, minScore, maxScore, status } = req.query;
    
    const filter: any = {};

    // 1. الفلترة حسب معرف الامتحان (إذا وجد)
    if (examId && examId !== 'undefined') {
      filter.examId = examId;
    }

    // 2. البحث باسم الطالب أو إيميله
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // 3. الفلترة حسب الدرجة
    if (minScore || maxScore) {
      filter.score = {};
      if (minScore) filter.score.$gte = Number(minScore);
      if (maxScore) filter.score.$lte = Number(maxScore);
    }

    // 4. الفلترة حسب الحالة (مراجعة أو قيد الانتظار)
    if (status === 'reviewed') filter.isReviewed = true;
    if (status === 'pending') filter.isReviewed = false;

    const ctx = (req as any).admin;
    if (ctx && ctx.role !== 'super') {
      const myExams = await Exam.find({ createdBy: ctx.email }).select('_id').lean();
      const ids = myExams.map(e => String(e._id));
      filter.examId = { $in: ids };
    }

    // جلب النتائج وترتيبها من الأحدث للأقدم
// ✅ في دالة GET /results (حوالي السطر 40-60)
const results = await ExamResult.find(filter)
  .populate('examId', 'title subjectId')  // ✅ أضف هذا السطر
  .sort({ submittedAt: -1 })
  .lean();

    console.log(`📊 Successfully found ${results.length} results.`);

    // إرسال الاستجابة بالهيكل الذي يتوقعه الـ Frontend (data.results)
    res.json({
      success: true,
      data: {
        results,
        total: results.length
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ أثناء جلب النتائج من قاعدة البيانات' 
    });
  }
});

// ✅ 3. جلب تفاصيل نتيجة معينة للمراجعة
// ✅ 3. جلب تفاصيل نتيجة معينة للمراجعة
router.get('/results/:resultId', adminAuth, async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await ExamResult.findById(resultId).lean();
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'النتيجة غير موجودة' });
    }

    // ✅ الأفضل استخدام examId مباشرة إن وجد
    let exam = null;
    if (result.examId) {
      exam = await Exam.findById(result.examId).lean();
    } else {
      exam = await Exam.findOne({ 
        $or: [
          { "title.ar": { $regex: result.examTopic, $options: 'i' } },
          { "title.en": { $regex: result.examTopic, $options: 'i' } }
        ]
      }).lean();
    }

    res.json({ success: true, data: { result, exam } });
  } catch (error: any) {
    console.error('❌ Error fetching result details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ 4. تحديث نتيجة (تعديل درجة أو إضافة ملاحظات)
router.patch('/results/:resultId', adminAuth, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { adminNotes, isReviewed, isPublished, perQuestionOverrides } = req.body;
    
    const update: any = {};
    if (adminNotes !== undefined) update.adminNotes = adminNotes;
    if (isReviewed !== undefined) update.isReviewed = isReviewed;
    if (isPublished !== undefined) update.isPublished = isPublished;
    if (Array.isArray(perQuestionOverrides)) update.perQuestionOverrides = perQuestionOverrides;

    // ✅ إعادة حساب الدرجة
    const existing = await ExamResult.findById(resultId).lean();
    if (!existing) {
      return res.status(404).json({ success: false, error: 'النتيجة غير موجودة' });
    }
    const overridesMap = new Map<string, { isCorrect?: boolean; awardedPoints?: number }>();
    (perQuestionOverrides || existing.perQuestionOverrides || []).forEach((o: any) => {
      overridesMap.set(String(o.id), { isCorrect: o.isCorrect, awardedPoints: o.awardedPoints });
    });
    let earned = 0;
    let total = 0;
    for (let i = 0; i < existing.questions.length; i++) {
      const q = existing.questions[i] as any;
      const ans = existing.answers[i];
      const ovr = overridesMap.get(String(q.id));
      const pts = q.points || 1;
      total += pts;
      if (q.type === 'essay' || q.type === 'fill-blank') {
        if (ovr && typeof ovr.awardedPoints === 'number') {
          earned += Math.max(0, Math.min(pts, ovr.awardedPoints));
        }
      } else {
        // موضوعي
        if (ovr && typeof ovr.isCorrect === 'boolean') {
          if (ovr.isCorrect) earned += pts;
        } else if (typeof ans === 'number' && ans >= 0 && ans === q.correctAnswer) {
          earned += pts;
        }
      }
    }
    const newScore = total > 0 ? Math.round((earned / total) * 100) : 0;
    update.score = newScore;

    const updated = await ExamResult.findByIdAndUpdate(
      resultId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    res.json({ success: true, message: 'تم التحديث بنجاح', data: updated });
  } catch (error: any) {
    console.error('❌ Error updating result:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ✅ حذف جماعي للنتائج
router.post('/results/bulk-delete', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No IDs provided' });
    }
    
    await ExamResult.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `Deleted ${ids.length} results` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ تصدير نتائج امتحان لـ PDF
router.get('/results/export-pdf', adminAuth, async (req, res) => {
  try {
    const { examId } = req.query;
    const filter: any = {};
    if (examId) filter.examId = examId;
    
    const results = await ExamResult.find(filter)
  .populate('examId', 'title subjectId')  // ✅ جلب بيانات الامتحان المرتبط
  .sort({ submittedAt: -1 })
  .lean();
    
    // هنا يمكنك استخدام مكتبة مثل pdfkit أو puppeteer لتوليد PDF
    // للتبسيط، سنرجع CSV مع تعليمات للتحويل
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=exam-results-${Date.now()}.csv`);
    
    const headers = ['الطالب', 'الإيميل', 'المادة', 'الدرجة', 'التاريخ', 'الحالة', 'ملاحظات'];
    const rows = results.map(r => [
      r.userName,
      r.userEmail,
      r.examTopic,
      r.score,
      new Date(r.submittedAt).toLocaleDateString('ar-EG'),
      r.isReviewed ? 'تمت المراجعة' : 'قيد المراجعة',
      r.adminNotes || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    res.send(csvContent);
    
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ✅ 5. تصدير النتائج لـ CSV
router.get('/results/export', adminAuth, async (req, res) => {
  try {
    const results = await ExamResult.find().sort({ submittedAt: -1 }).lean();
    
    const headers = ['الطالب', 'الإيميل', 'المادة', 'الدرجة', 'التاريخ', 'ملاحظات'];
    const rows = results.map(r => [
      r.userName,
      r.userEmail,
      r.examTopic,
      r.score,
      new Date(r.submittedAt).toLocaleDateString('ar-EG'),
      r.adminNotes || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=exam-results-${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('❌ Error exporting results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as adminStatsRoutes };
