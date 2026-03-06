"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSettingsRoutes = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const ThemeSettings_1 = require("../models/ThemeSettings");
const multer_1 = require("../config/multer");
const router = (0, express_1.Router)();
exports.adminSettingsRoutes = router;
router.use(adminAuth_1.adminAuth);
router.get('/', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const doc = await ThemeSettings_1.ThemeSettings.findOne({}).lean();
    res.json({ success: true, data: doc });
});
router.put('/', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const payload = req.body || {};
    const updated = await ThemeSettings_1.ThemeSettings.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true }).lean();
    res.json({ success: true, data: updated });
});
router.post('/upload', multer_1.upload.single('file'), async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    if (!req.file)
        return res.status(400).json({ success: false, error: 'no file' });
    const type = req.query.type || 'logo';
    const url = `/uploads/${req.file.filename}`;
    const set = {};
    if (type === 'favicon')
        set['branding.faviconUrl'] = url;
    else
        set['branding.logoUrl'] = url;
    const updated = await ThemeSettings_1.ThemeSettings.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true }).lean();
    res.json({ success: true, data: updated });
});
