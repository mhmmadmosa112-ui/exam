import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { ExamResult } from '../models/ExamResult';
import { BlockedUser } from '../models/BlockedUser';
import { RetakeRequest } from '../models/RetakeRequest';

const router = Router();
router.use(adminAuth);

router.get('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (!ctx.permissions?.canViewResults && ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const rows = await ExamResult.aggregate([
    { $group: { _id: { userId: '$userId', userEmail: '$userEmail' }, userName: { $first: '$userName' }, last: { $max: '$submittedAt' } } },
    { $sort: { last: -1 } }
  ]);
  const blocked = await BlockedUser.find({}).lean();
  const blockedSet = new Set(blocked.map(b => `${b.userId}|${b.userEmail}`));
  const data = rows.map(r => ({
    userId: r._id.userId,
    userEmail: r._id.userEmail,
    userName: r.userName,
    last: r.last,
    blocked: blockedSet.has(`${r._id.userId}|${r._id.userEmail}`)
  }));
  res.json({ success: true, data });
});

// ✅ طلبات إعادة المحاولة
router.get('/retake-requests', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const rows = await RetakeRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: rows });
});

router.post('/retake-approve', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const { examId, userEmail, userId } = req.body;
  if (!examId || !userEmail || !userId) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
  await ExamResult.deleteMany({ examId: String(examId), userEmail });
  await RetakeRequest.findOneAndUpdate({ examId: String(examId), userId: String(userId) }, { $set: { status: 'approved' } });
  res.json({ success: true });
});

router.post('/block', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const { userId, userEmail, reason } = req.body;
  if (!userId || !userEmail) return res.status(400).json({ success: false, error: 'userId,userEmail required' });
  await BlockedUser.findOneAndUpdate({ userId, userEmail }, { $set: { reason } }, { upsert: true, new: true });
  res.json({ success: true });
});

router.post('/unblock', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const { userId, userEmail } = req.body;
  await BlockedUser.deleteOne({ userId, userEmail });
  res.json({ success: true });
});

export { router as adminStudentsRoutes };
