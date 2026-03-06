"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminProfileRoutes = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const AdminUser_1 = require("../models/AdminUser");
const router = (0, express_1.Router)();
exports.adminProfileRoutes = router;
router.use(adminAuth_1.adminAuth);
router.get('/', async (req, res) => {
    const ctx = req.admin;
    const existing = await AdminUser_1.AdminUser.findOne({ email: ctx.email }).lean();
    if (!existing) {
        const doc = new AdminUser_1.AdminUser({
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
router.patch('/', async (req, res) => {
    const ctx = req.admin;
    const { profile } = req.body;
    const updated = await AdminUser_1.AdminUser.findOneAndUpdate({ email: ctx.email }, { $set: { profile: profile || {} } }, { new: true, upsert: true }).lean();
    res.json({ success: true, data: updated });
});
