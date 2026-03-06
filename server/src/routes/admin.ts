import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// دالة بسيطة لتحويل JSON إلى CSV (بديل لـ json2csv)
function jsonToCsv(data: any[], delimiter = ';'): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(delimiter)];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const escaped = ('' + value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(delimiter));
  }
  
  return csvRows.join('\n');
}

// Middleware للتحقق من صلاحية الأدمن
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  const userEmail = req.headers['x-user-email'] as string;
  
  if (!userEmail || !adminEmails.includes(userEmail)) {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح - تحتاج صلاحية أدمن'
    });
  }
  next();
};

// جلب جميع نتائج الامتحانات (مع فلترة)
router.get('/results', adminAuth, async (req, res) => {
  try {
    const { ExamResult } = await import('../models/ExamResult');
    
    const { 
      page = 1, 
      limit = 20, 
      topic, 
      minScore, 
      maxScore, 
      startDate, 
      endDate 
    } = req.query;

    const filter: any = {};
    if (topic) filter.examTopic = { $regex: topic, $options: 'i' };
    if (minScore || maxScore) {
      filter.score = {};
      if (minScore) filter.score.$gte = Number(minScore);
      if (maxScore) filter.score.$lte = Number(maxScore);
    }
    if (startDate || endDate) {
      filter.submittedAt = {};
      if (startDate) filter.submittedAt.$gte = new Date(startDate as string);
      if (endDate) filter.submittedAt.$lte = new Date(endDate as string);
    }

    const results = await ExamResult.find(filter)
      .sort({ submittedAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await ExamResult.countDocuments(filter);

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
  } catch (error: any) {
    console.error('❌ Error fetching admin results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث نتيجة (تعديل الدرجة أو إضافة ملاحظة)
router.patch('/results/:resultId', adminAuth, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { score, adminNotes, isReviewed } = req.body;

    const { ExamResult } = await import('../models/ExamResult');

    const update: any = {};
    if (score !== undefined) update.score = score;
    if (adminNotes !== undefined) update.adminNotes = adminNotes;
    if (isReviewed !== undefined) update.isReviewed = isReviewed;
    update.isReviewed = true;

    const updated = await ExamResult.findByIdAndUpdate(
      resultId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على النتيجة' });
    }

    res.json({
      success: true,
      message: 'تم تحديث النتيجة بنجاح',
      data: { updated }
    });
  } catch (error: any) {
    console.error('❌ Error updating result:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// تصدير النتائج لـ Excel/CSV (بدون مكتبات خارجية)
router.get('/results/export', adminAuth, async (req, res) => {
  try {
    const { ExamResult } = await import('../models/ExamResult');
    
    const results = await ExamResult.find({})
      .select('-questions -answers')
      .sort({ submittedAt: -1 })
      .lean();

    const exportData = results.map((r: any) => ({
      'معرف_الطالب': r.userId,
      'الاسم': r.userName,
      'البريد': r.userEmail,
      'المادة': r.examTopic,
      'الدرجة': r.score,
      'المدة_دقيقة': r.duration,
      'الوقت_المستغرق_ثانية': r.timeSpent,
      'تاريخ_التقديم': new Date(r.submittedAt).toLocaleString('ar-EG'),
      'مراجع': r.isReviewed ? 'نعم' : 'لا',
      'ملاحظات_الادمن': r.adminNotes || '-'
    }));

    const csv = jsonToCsv(exportData, ';');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=exam-results-${Date.now()}.csv`);
    res.send('\uFEFF' + csv);

  } catch (error: any) {
    console.error('❌ Error exporting results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// إحصائيات سريعة
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { ExamResult } = await import('../models/ExamResult');

    const stats = await ExamResult.aggregate([
      {
        $group: {
          _id: '$examTopic',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' }
        }
      }
    ]);

    const totalStudents = await ExamResult.distinct('userId').countDocuments();
    const totalExams = await ExamResult.countDocuments();

    res.json({
      success: true,
      data: {
        totalStudents,
        totalExams,
        byTopic: stats
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Endpoint جديد: جلب تفاصيل امتحان واحد (مع الأسئلة والإجابات)
router.get('/results/:resultId', adminAuth, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { ExamResult } = await import('../models/ExamResult');

    const result = await ExamResult.findById(resultId).lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'لم يتم العثور على نتيجة الامتحان'
      });
    }

    // ✅ التصحيح: data: { result }
    res.json({
      success: true,
      data: { result }
    });
  } catch (error: any) {
    console.error('❌ Error fetching exam result:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as adminRoutes };