import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { AdminUser } from '../models/AdminUser';

const router = Router();

router.use(adminAuth);

router.get('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const users = await AdminUser.find({}).lean();
  res.json({ success: true, data: users });
});

router.post('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const { email, permissions, profile } = req.body;
  const existing = await AdminUser.findOne({ email }).lean();
  if (existing) return res.status(400).json({ success: false, error: 'موجود مسبقاً' });
  const doc = new AdminUser({
    email,
    role: 'sub',
    permissions: {
      canManageSubjects: !!permissions?.canManageSubjects,
      canManageExams: !!permissions?.canManageExams,
      canViewResults: permissions?.canViewResults !== false,
      canManageAdmins: false,
      canGradeEssays: !!permissions?.canGradeEssays
    },
    profile: profile || {}
  });
  await doc.save();
  res.status(201).json({ success: true, data: doc });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const { permissions, profile } = req.body;
  const update: any = {};
  if (permissions) update.permissions = permissions;
  if (profile) update.profile = profile;
  const updated = await AdminUser.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
  if (!updated) return res.status(404).json({ success: false, error: 'غير موجود' });
  res.json({ success: true, data: updated });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  await AdminUser.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'تم الحذف' });
});

export { router as adminUsersRoutes };
