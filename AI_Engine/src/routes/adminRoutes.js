const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const legalDataRoutes = require('./legalDataRoutes');
const feedbackController = require('../controllers/feedbackController');
const { isAdmin } = require('../middleware/authMiddleware');

// Route lấy thống kê hệ thống - chỉ dành cho Admin
router.get('/stats', isAdmin, adminController.getSystemStats);

// Route Thu thập & Đồng bộ Pháp luật - chỉ dành cho Admin
router.post('/crawl', isAdmin, adminController.crawlAndSyncLaw);
router.post('/crawler/run-manual', isAdmin, adminController.runManualCrawl);
router.get('/crawler/history', isAdmin, adminController.getRecentHistory);

// Routes cho Crawler Settings
router.get('/crawler/settings', isAdmin, adminController.getCrawlerSettings);
router.put('/crawler/settings', isAdmin, adminController.updateCrawlerSettings);
router.get('/crawler/status', isAdmin, adminController.getCrawlerStatus);

//  các route khác cho admin ở đây
router.get('/users', isAdmin, adminController.getAllUsers);
router.post('/users', isAdmin, adminController.createUser);
router.put('/users/:id/ban', isAdmin, adminController.toggleUserBan);
router.get('/feature-usage', isAdmin, adminController.getFeatureUsage);
router.get('/history-analytics', isAdmin, adminController.getAiHistory);

router.use('/legal-documents', legalDataRoutes);

// ============================================================
// PHẢN HỒI - QUẢN LÝ PHẢN HỒI NGƯỜI DÙNG (CHỈ ADMIN)
// ============================================================
router.get('/feedback', isAdmin, feedbackController.getFeedbacks);
router.put('/feedback/status', isAdmin, feedbackController.updateStatus);
router.post('/feedback/reply', isAdmin, feedbackController.replyFeedback);

module.exports = router;