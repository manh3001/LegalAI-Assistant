require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const { sql, pool, poolConnect } = require('./config/db');
const crawlService = require('./services/crawlService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Cho phép tất cả origins, có thể cấu hình cụ thể
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes (giả sử có routes)
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Biến để track lần chạy cuối cùng của auto crawl
let lastAutoCrawlDate = null;

// Cron job chạy mỗi phút để kiểm tra auto crawl
cron.schedule('* * * * *', async () => {
    try {
        console.log('🔄 [CRON] Kiểm tra auto crawl...');

        await poolConnect;

        // Đọc cấu hình từ SystemSettings
        const settingsResult = await pool.request().query('SELECT * FROM SystemSettings WHERE Id = 1');
        if (settingsResult.recordset.length === 0) {
            console.log('⚠️  Không tìm thấy cấu hình SystemSettings');
            return;
        }

        const settings = settingsResult.recordset[0];
        const { isAutoCrawlOn, crawlTime, targetUrls, dailyLimit } = settings;

        if (isAutoCrawlOn !== 1) {
            console.log('🚫 Auto crawl bị tắt');
            return;
        }

        // Parse crawlTime (vd: "15:30")
        const [hour, minute] = crawlTime.split(':').map(Number);
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        if (currentHour !== hour || currentMinute !== minute) {
            console.log(` Chưa đến giờ crawl. Hiện tại: ${currentHour}:${currentMinute}, Cần: ${hour}:${minute}`);
            return;
        }

        // Kiểm tra đã chạy hôm nay chưa
        const today = now.toDateString();
        if (lastAutoCrawlDate === today) {
            console.log(' Đã chạy auto crawl hôm nay');
            return;
        }

        console.log(' [AUTO CRAWL START] Bắt đầu thu thập tự động');

        // Parse targetUrls (JSON array)
        let urls = [];
        try {
            urls = JSON.parse(targetUrls);
        } catch (parseError) {
            console.error(' Lỗi parse targetUrls:', parseError);
            return;
        }

        if (!Array.isArray(urls) || urls.length === 0) {
            console.log('⚠️  Không có URLs để crawl');
            return;
        }

        // Giới hạn theo dailyLimit
        const limitedUrls = urls.slice(0, dailyLimit || 10);

        // Gọi processLegalCrawl với io
        await crawlService.processLegalCrawl(limitedUrls, io);

        // Cập nhật lastAutoCrawlDate
        lastAutoCrawlDate = today;

        console.log(' [AUTO CRAWL SUCCESS] Hoàn thành thu thập tự động');

    } catch (error) {
        console.error(' [CRON ERROR]', error);
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
});
