import { Request, Response, NextFunction } from 'express';
import { AdminUser } from '../models/AdminUser';

export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userEmail = req.headers['x-user-email'] as string;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'غير مسجل الدخول' });
    }
    const superEmail = 'mhmmad.mosa112@gmail.com';
    if (superEmail && userEmail.toLowerCase() === superEmail.toLowerCase()) {
      (req as any).admin = {
        email: userEmail,
        role: 'super',
        permissions: {
          canManageSubjects: true,
          canManageExams: true,
          canViewResults: true,
          canManageAdmins: true,
          canGradeEssays: true
        }
      };
      return next();
    }
    const admin = await AdminUser.findOne({ email: userEmail }).lean();
    if (!admin) {
      return res.status(403).json({ success: false, error: 'غير مصرح' });
    }
    (req as any).admin = {
      email: userEmail,
      role: admin.role,
      permissions: admin.permissions
    };
    next();
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'خطأ في التحقق' });
  }
};

export const requirePermission = (perm: keyof (typeof AdminUser)['prototype']['permissions']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = (req as any).admin;
    if (!ctx) return res.status(401).json({ success: false, error: 'غير مصرح' });
    if (ctx.role === 'super') return next();
    if (ctx.permissions && ctx.permissions[perm]) return next();
    return res.status(403).json({ success: false, error: 'صلاحيات غير كافية' });
  };
};
