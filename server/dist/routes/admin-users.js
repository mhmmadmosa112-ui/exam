"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUsersRoutes = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const AdminUser_1 = require("../models/AdminUser");
const router = (0, express_1.Router)();
exports.adminUsersRoutes = router;
router.use(adminAuth_1.adminAuth);
router.get('/', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const users = await AdminUser_1.AdminUser.find({}).lean();
    res.json({ success: true, data: users });
});
router.post('/', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const { email, permissions, profile } = req.body;
    const existing = await AdminUser_1.AdminUser.findOne({ email }).lean();
    if (existing)
        return res.status(400).json({ success: false, error: 'موجود مسبقاً' });
    const doc = new AdminUser_1.AdminUser({
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
router.patch('/:id', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const { permissions, profile } = req.body;
    const update = {};
    if (permissions)
        update.permissions = permissions;
    if (profile)
        update.profile = profile;
    const updated = await AdminUser_1.AdminUser.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!updated)
        return res.status(404).json({ success: false, error: 'غير موجود' });
    res.json({ success: true, data: updated });
});
router.delete('/:id', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    await AdminUser_1.AdminUser.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
});
