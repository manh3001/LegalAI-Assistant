const express = require('express');
const router = express.Router();

// 1. Import middleware xác thực
const { authMiddleware } = require('../middleware/authMiddleware');

// 2. Import các controller
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const historyController = require('../controllers/historyController');
const aiController = require('../controllers/aiController');
const adminController = require('../controllers/adminController');

// ============================================================
// NHÓM 1: ROUTES CÔNG KHAI (KHÔNG CẦN LOGIN)
// ============================================================

// --- Auth công khai ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// --- Tra cứu văn bản công khai ---
router.get('/documents', documentController.getAllDocuments);
router.get('/documents/:id', documentController.getDocumentDetail);
router.get('/document-stats', documentController.getDocumentStats);

// ============================================================
// NHÓM 2: KÍCH HOẠT BẢO VỆ JWT (TẤT CẢ ROUTE DƯỚI ĐÂY PHẢI CÓ TOKEN)
// ============================================================
router.use(authMiddleware);

// --- AI Planning & Contract Analysis ---
router.post('/ai/generate-planning', aiController.generatePlanning);
router.post('/ai/analyze-contract', aiController.analyzeContract);

// --- Hồ sơ người dùng ---
router.put('/users/profile', authController.updateProfile);
router.delete('/users/account', authController.deleteAccount);

// --- Lịch sử phân tích chung ---
router.post('/history/save-video', historyController.saveVideoAnalysis);
router.post('/history/save', historyController.saveAnalysis);
router.get('/history/:userId', historyController.getHistory);
router.get('/history/detail/:id', historyController.getDetail);
router.delete('/history/delete/:id', historyController.deleteHistory);
router.put('/history/update/:id', historyController.updateHistory);

// ============================================================
// NHÓM 3: LUẬT CỦA TÔI & VỪA XEM GẦN ĐÂY (CLEAN SYNC)
// ============================================================

// --- Luật của tôi  ---
// 
router.post('/user/toggle-saved-law', adminController.toggleSaveLaw);

// --- Vừa xem gần đây  ---

router.post('/user/record-view', adminController.recordRecentView);

// --- Lấy danh sách hiển thị ---

router.get('/user/saved-laws/:userId', historyController.getSavedLaws);
router.get('/user/recent-docs/:userId', historyController.getRecentDocs);

// --- Xóa bỏ (Nếu cần) ---
router.delete('/user/remove-saved-law', historyController.removeSavedLaw);
router.delete('/user/remove-recent-doc', historyController.removeRecentDoc);

module.exports = router;