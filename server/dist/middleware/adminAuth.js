"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.adminAuth = void 0;
const AdminUser_1 = require("../models/AdminUser");
const adminAuth = async (req, res, next) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) {
            return res.status(401).json({ success: false, error: 'غير مسجل الدخول' });
        }
        const superEmail = 'mhmmad.mosa112@gmail.com';
        if (superEmail && userEmail.toLowerCase() === superEmail.toLowerCase()) {
            req.admin = {
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
        const admin = await AdminUser_1.AdminUser.findOne({ email: userEmail }).lean();
        if (!admin) {
            return res.status(403).json({ success: false, error: 'غير مصرح' });
        }
        req.admin = {
            email: userEmail,
            role: admin.role,
            permissions: admin.permissions
        };
        next();
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message || 'خطأ في التحقق' });
    }
};
exports.adminAuth = adminAuth;
const requirePermission = (perm) => {
    return (req, res, next) => {
        const ctx = req.admin;
        if (!ctx)
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        if (ctx.role === 'super')
            return next();
        if (ctx.permissions && ctx.permissions[perm])
            return next();
        return res.status(403).json({ success: false, error: 'صلاحيات غير كافية' });
    };
};
exports.requirePermission = requirePermission;
