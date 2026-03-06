import { Router, Request, Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { ThemeSettings } from '../models/ThemeSettings';
import { upload } from '../config/multer';

const router = Router();

router.use(adminAuth);

router.get('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const doc = await ThemeSettings.findOne({}).lean();
  res.json({ success: true, data: doc });
});

router.put('/', async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  const payload = req.body || {};
  const updated = await ThemeSettings.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true }).lean();
  res.json({ success: true, data: updated });
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const ctx = (req as any).admin;
  if (ctx.role !== 'super') return res.status(403).json({ success: false, error: 'غير مصرح' });
  if (!req.file) return res.status(400).json({ success: false, error: 'no file' });
  const type = (req.query.type as string) || 'logo';
  const url = `/uploads/${req.file.filename}`;
  const set: any = {};
  if (type === 'favicon') set['branding.faviconUrl'] = url;
  else set['branding.logoUrl'] = url;
  const updated = await ThemeSettings.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true }).lean();
  res.json({ success: true, data: updated });
});

export { router as adminSettingsRoutes };
