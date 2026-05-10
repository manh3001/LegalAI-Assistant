const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const lawyerController = require('../controllers/lawyerController');
const multer = require('multer');
const path = require('path');

// Cấu hình upload file tạm
const upload = multer({
    dest: path.join(__dirname, '../../uploads/')
});

// 1. Chat / RAG
router.post('/ask', aiController.ask);

// 2. Phân tích hợp đồng (File Upload)
router.post('/analyze-contract', upload.single('file'), aiController.analyzeContract);

// 3. Lập kế hoạch báo cáo (File Upload)
router.post('/generate-planning', upload.array('files', 10), aiController.generatePlanning);
router.post('/generate-plan', upload.array('files', 10), aiController.generatePlanning);

// 4. Soạn thảo văn bản
router.post('/generate-form', aiController.generateForm);

// 5. Phân tích Video
router.post('/analyze-video', aiController.analyzeVideo);

// 6. Luật sư
router.get('/lawyers', lawyerController.getLawyers);
router.get('/lawyers/random', lawyerController.getRandomLawyer);

module.exports = router;