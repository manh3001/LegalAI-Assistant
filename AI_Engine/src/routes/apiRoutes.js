const express = require('express');
const router = express.Router();

// 1. Import middleware
const { authMiddleware } = require('../middleware/authMiddleware');

// 2. Import các controller
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const historyController = require('../controllers/historyController');
const aiController = require('../controllers/aiController'); 

// ============================================================
// NHÓM 1: ROUTES CÔNG KHAI (KHÔNG CẦN LOGIN)
// ============================================================

// --- Auth công khai ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// --- Tra cứu văn bản công khai (User vãng lai vẫn xem được) ---
router.get('/documents', documentController.getAllDocuments);
router.get('/documents/:id', documentController.getDocumentDetail);
router.get('/document-stats', documentController.getDocumentStats);

router.post('/history/save', historyController.saveAnalysis);
router.get('/history/:userId', historyController.getHistory);
// ============================================================
// NHÓM 2: KÍCH HOẠT BẢO VỆ JWT (TẤT CẢ ROUTE DƯỚI ĐÂY PHẢI CÓ TOKEN)
// ============================================================
router.use(authMiddleware);

// --- AI Planning (Dành cho Member) ---
router.post('/ai/generate-planning', aiController.generatePlanning);
router.post('/ai/analyze-contract', aiController.analyzeContract);

// --- Lịch sử phân tích (Dành cho Member) ---

router.get('/history/detail/:id', historyController.getDetail);
router.delete('/history/delete/:id', historyController.deleteHistory);

// NEW ROUTES: Luật của tôi & Vừa xem gần đây (Không dùng authenticateToken)
// Lấy danh sách luật đã lưu cho một người dùng cụ thể
router.get('/user/saved-laws/:userId', historyController.getSavedLaws);
router.post('/user/toggle-saved-law', historyController.toggleSavedLaw); 
router.delete('/user/remove-saved-law', historyController.removeSavedLaw); 

// Lấy danh sách tài liệu vừa xem gần đây cho một người dùng cụ thể
router.get('/user/recent-docs/:userId', historyController.getRecentDocs);
router.post('/user/add-recent-doc', historyController.addRecentDoc); 
router.delete('/user/remove-recent-doc', historyController.removeRecentDoc); 

module.exports = router;