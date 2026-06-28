const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { poolConnect } = require('./config/db');

// 1. Load cấu hình
dotenv.config({ path: path.join(__dirname, '../.env') });
const PORT = process.env.PORT || 8000;
const app = express();

// Tạo Server HTTP bọc Express để chạy được Socket.io
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
global.io = io;

// 2. Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Import Routes
const schedulerService = require('./services/schedulerService');
const aiRoutes = require('./routes/aiRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingRoutes = require('./routes/settingRoutes');

// 5. Mount Routes 
app.use('/api/ai', aiRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/settings', settingRoutes);

// 6. Test Route
app.get('/', (req, res) => {
    res.send(' LegAI Engine is running on Port ' + PORT);
});

// 7. Start Server 
const startServer = async () => {
    try {
        console.log(" Đang khởi động AI Engine...");


        await poolConnect;

        // Load SystemConfig từ DB một cách an toàn
        const SystemConfig = require('./config/SystemConfig');
        await SystemConfig.loadFromDB();

        schedulerService.init(io);

        server.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(` LEGAI BACKEND & SOCKET.IO STARTED AT: http://localhost:${PORT}`);
            console.log(` Full Modular + Real-time Socket.io + Auto Scheduler`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error(" Không thể khởi động Server:", error);
    }
};

startServer();