import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { AdminUser } from '../models/AdminUser';

const router = Router();

router.use(adminAuth);

router.get('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  const existing = await AdminUser.findOne({ email: ctx.email }).lean();
  if (!existing) {
    const doc = new AdminUser({
      email: ctx.email,
      role: ctx.role || 'sub',
      permissions: ctx.permissions || {},
      profile: {}
    });
    await doc.save();
    return res.json({ success: true, data: doc });
  }
  res.json({ success: true, data: existing });
});

router.patch('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  const { profile } = req.body;
  const updated = await AdminUser.findOneAndUpdate(
    { email: ctx.email },
    { $set: { profile: profile || {} } },
    { new: true, upsert: true }
  ).lean();
  res.json({ success: true, data: updated });
});

export { router as adminProfileRoutes };
