"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectRoutes = void 0;
const express_1 = require("express");
const Subject_1 = require("../models/Subject");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.subjectRoutes = router;
// ==================== CRUD للمواد ====================
// 1. جلب جميع المواد
router.get('/', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const { lang = 'ar', search } = req.query;
        const ctx = req.admin;
        const filter = { isActive: true };
        if (search) {
            filter.$or = [
                { 'name.ar': { $regex: search, $options: 'i' } },
                { 'name.en': { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }
        if (!ctx || ctx.role !== 'super') {
            filter.createdBy = ctx.email;
        }
        const subjects = await Subject_1.Subject.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: subjects });
    }
    catch (error) {
        console.error('❌ Error fetching subjects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 2. جلب مادة واحدة
router.get('/:id', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const subject = await Subject_1.Subject.findById(req.params.id).lean();
        if (!subject) {
            return res.status(404).json({ success: false, error: 'المادة غير موجودة' });
        }
        res.json({ success: true, data: subject });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// 3. إنشاء مادة جديدة
router.post('/', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageSubjects'), async (req, res) => {
    try {
        const { name, description, code } = req.body;
        const userEmail = req.headers['x-user-email'];
        // تحقق من التكرار
        const existing = await Subject_1.Subject.findOne({
            $or: [{ 'name.ar': name.ar }, { 'name.en': name.en }, { code }]
        });
        if (existing) {
            return res.status(400).json({ success: false, error: 'المادة موجودة مسبقاً' });
        }
        const subject = new Subject_1.Subject({
            name: { ar: name.ar, en: name.en },
            description: description ? { ar: description.ar, en: description.en } : undefined,
            code,
            createdBy: userEmail,
            isActive: true
        });
        await subject.save();
        res.status(201).json({ success: true, message: 'تم إنشاء المادة بنجاح', data: subject });
    }
    catch (error) {
        console.error('❌ Error creating subject:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 4. تحديث مادة
router.patch('/:id', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageSubjects'), async (req, res) => {
    try {
        const { name, description, code, isActive } = req.body;
        const ctx = req.admin;
        const update = {};
        if (name)
            update.name = { ar: name.ar, en: name.en };
        if (description)
            update.description = { ar: description.ar, en: description.en };
        if (code)
            update.code = code;
        if (typeof isActive === 'boolean')
            update.isActive = isActive;
        const baseFilter = { _id: req.params.id };
        if (ctx.role !== 'super')
            baseFilter.createdBy = ctx.email;
        const updated = await Subject_1.Subject.findOneAndUpdate(baseFilter, { $set: update }, { new: true, runValidators: true }).lean();
        if (!updated) {
            return res.status(404).json({ success: false, error: 'المادة غير موجودة' });
        }
        res.json({ success: true, message: 'تم تحديث المادة بنجاح', data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// 5. حذف مادة (Soft Delete)
router.delete('/:id', adminAuth_1.adminAuth, (0, adminAuth_1.requirePermission)('canManageSubjects'), async (req, res) => {
    try {
        const ctx = req.admin;
        const baseFilter = { _id: req.params.id };
        if (ctx.role !== 'super')
            baseFilter.createdBy = ctx.email;
        const updated = await Subject_1.Subject.findOneAndUpdate(baseFilter, { $set: { isActive: false } }, { new: true }).lean();
        if (!updated) {
            return res.status(404).json({ success: false, error: 'المادة غير موجودة' });
        }
        res.json({ success: true, message: 'تم حذف المادة بنجاح' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
