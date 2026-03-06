"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminStudentsRoutes = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const ExamResult_1 = require("../models/ExamResult");
const BlockedUser_1 = require("../models/BlockedUser");
const router = (0, express_1.Router)();
exports.adminStudentsRoutes = router;
router.use(adminAuth_1.adminAuth);
router.get('/', async (req, res) => {
    const ctx = req.admin;
    if (!ctx.permissions?.canViewResults && ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const rows = await ExamResult_1.ExamResult.aggregate([
        { $group: { _id: { userId: '$userId', userEmail: '$userEmail' }, userName: { $first: '$userName' }, last: { $max: '$submittedAt' } } },
        { $sort: { last: -1 } }
    ]);
    const blocked = await BlockedUser_1.BlockedUser.find({}).lean();
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
router.post('/block', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const { userId, userEmail, reason } = req.body;
    if (!userId || !userEmail)
        return res.status(400).json({ success: false, error: 'userId,userEmail required' });
    await BlockedUser_1.BlockedUser.findOneAndUpdate({ userId, userEmail }, { $set: { reason } }, { upsert: true, new: true });
    res.json({ success: true });
});
router.post('/unblock', async (req, res) => {
    const ctx = req.admin;
    if (ctx.role !== 'super')
        return res.status(403).json({ success: false, error: 'غير مصرح' });
    const { userId, userEmail } = req.body;
    await BlockedUser_1.BlockedUser.deleteOne({ userId, userEmail });
    res.json({ success: true });
});
