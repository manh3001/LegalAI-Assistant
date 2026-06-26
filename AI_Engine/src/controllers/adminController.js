const { sql, pool, poolConnect } = require('../config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require('bcryptjs');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Khởi tạo Gemini cho embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
const geminiService = require('../services/geminiService');
const crawlService = require('../services/crawlService');
// Khởi tạo Pinecone client
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const getSystemStats = async (req, res) => {
    try {
        // Đảm bảo kết nối database đã sẵn sàng
        await poolConnect;

        // 1. Thực hiện truy vấn SQL để lấy tổng số users
        const result = await pool.request().query('SELECT COUNT(*) as TotalUsers FROM dbo.Users');
        const totalUsers = result.recordset[0].TotalUsers;

        // 2. Đếm tổng số Hồ sơ pháp lý 
        const recordResult = await pool.request().query('SELECT COUNT(Id) as TotalRecords FROM dbo.ContractHistory');
        const realAiRecords = recordResult.recordset[0].TotalRecords;

        // 3. Lấy dung lượng Vector thực tế từ Pinecone
        let usedVectors = 0;
        const maxVectors = 100000; // Quota mặc định của gói Free
        try {

            const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
            const index = pc.index(indexName);

            // Gọi hàm thống kê
            const stats = await index.describeIndexStats();
            usedVectors = stats.totalRecordCount || 0;
        } catch (pineconeError) {
            console.error('Lỗi khi lấy data từ Pinecone:', pineconeError);
            // Nếu lỗi mạng/key thì tạm để 0 chứ không cho crash sập toàn hệ thống
        }

        const vectorQuota = {
            used: usedVectors,
            total: maxVectors,
            // Tính phần trăm và làm tròn đến 1 chữ số thập phân
            percentage: Math.round((usedVectors / maxVectors) * 1000) / 10
        };

        res.json({
            success: true,
            data: {
                totalUsers: totalUsers,
                aiRecords: realAiRecords,
                vectorQuota: vectorQuota
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy thống kê hệ thống:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê hệ thống',
            error: error.message
        });
    }
};

// ============================================================
// HÀM LẤY CẤU HÌNH HỆ THỐNG
// ============================================================

const getSystemSettings = async () => {
    try {
        // LẤY CẢ pool VÀ poolConnect ra 
        const { pool, poolConnect } = require('../config/db');

        // Chờ kết nối mở xong
        await poolConnect;

        // Dùng biến pool đã lấy ở trên để query
        const result = await pool.request().query(`SELECT * FROM dbo.SystemSettings ORDER BY UpdatedAt DESC LIMIT 1`);

        return result.recordset[0];
    } catch (error) {
        console.error("Lỗi SQL khi lấy Settings:", error.message);
        return null;
    }
};

// ============================================================
// HÀM LẤY CẤU HÌNH CRAWLER
// ============================================================



const getCrawlerSettings = async (req, res) => {
    try {
        await poolConnect;

        const result = await pool.request().query('SELECT * FROM SystemSettings WHERE Id = 1');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cấu hình hệ thống'
            });
        }

        const settings = result.recordset[0];


        res.json({
            success: true,
            data: settings
        });

    } catch (error) {
        console.error('Lỗi khi lấy cấu hình crawler:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy cấu hình crawler',
            error: error.message
        });
    }
};

// ============================================================
// HÀM CẬP NHẬT CẤU HÌNH CRAWLER
// ============================================================

const updateCrawlerSettings = async (req, res) => {
    try {
        const { isAutoCrawlOn, crawlTime, targetUrls, dailyLimit, filterPatterns } = req.body;

        await poolConnect;

        const request = pool.request();
        request.input('isAutoCrawlOn', sql.Bit, isAutoCrawlOn);
        request.input('crawlTime', sql.VarChar, crawlTime);
        request.input('targetUrls', sql.NVarChar(sql.MAX), targetUrls);
        request.input('dailyLimit', sql.Int, dailyLimit);
        request.input('filterPatterns', sql.NVarChar(500), filterPatterns);

        const updateQuery = `
            UPDATE SystemSettings 
            SET isAutoCrawlOn = @isAutoCrawlOn, 
                crawlTime = @crawlTime, 
                targetUrls = @targetUrls, 
                dailyLimit = @dailyLimit, 
                filterPatterns = @filterPatterns 
            WHERE Id = 1
        `;

        await request.query(updateQuery);

        res.json({
            success: true,
            message: 'Cập nhật cấu hình crawler thành công'
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật cấu hình crawler:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật cấu hình crawler',
            error: error.message
        });
    }
};

//  Hàm crawl và đồng bộ dữ liệu thủ công (Dành cho Admin)
// gọi crawlService để crawl, sau đó tự động đồng bộ vào SQL + Pinecone
const crawlAndSyncLaw = async (req, res) => {
    try {
        const { url } = req.body;

        // Kiểm tra hợp lệ cơ bản
        if (!url || !url.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp URL hợp lệ' });
        }

        console.log(`\n [ADMIN MANUAL CRAWL] Bắt đầu xử lý URL: ${url}`);


        const result = await crawlService.processLegalCrawl([url], global.io);

        // Phân tích kết quả trả về từ Service
        if (result.successCount > 0) {
            return res.json({
                success: true,
                message: 'Thu thập & Đồng bộ thành công!',
                data: result
            });
        }

        if (result.duplicateCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Văn bản này đã tồn tại trong hệ thống.',
                data: result
            });
        }

        // Nếu rơi vào đây là failCount > 0
        throw new Error('Thu thập thất bại. Vui lòng kiểm tra Terminal Backend để xem chi tiết lỗi.');

    } catch (error) {
        console.error(' [ADMIN CONTROLLER ERROR]:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi server khi thu thập dữ liệu',
        });
    }
};

const getRecentHistory = async (req, res) => {
    try {
        await poolConnect;

        const result = await pool.request().query(`
            SELECT Id, Title, DocumentNumber, Category, SourceUrl, Status, CreatedAt
            FROM dbo.LegalDocuments
            ORDER BY CreatedAt DESC LIMIT 10
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('[GET HISTORY ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lịch sử thu thập',
            error: error.message
        });
    }
};
const extremeDeepClean = (text) => {
    if (!text) return "";
    return text
        // 1. Hàn các từ bị chẻ đôi với khoảng trắng (NAM\nĐộc lập -> NAM Độc lập)
        .replace(/([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])[\s]*[\n\r]+[\s]*([a-záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ])/gi, '$1 $2')

        // 2. Nối các dòng thuộc cùng một câu (Dòng kết thúc không phải dấu chấm/hỏi/than)
        .replace(/([^.!?:\n])\n(?![A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ])[\s]*/g, '$1 ')

        // 3. Fix cứng các cụm từ quan trọng
        .replace(/Qu\s+ốc hội/gi, 'Quốc hội')
        .replace(/Cộng\s+hòa/gi, 'Cộng hòa')
        .replace(/Xã\s+hội/gi, 'Xã hội')

        // 4. Thu gọn khoảng trắng và định dạng lại đoạn văn (\n\n)
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
};
const runManualCrawl = async (req, res) => {
    try {
        const { urls } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách URLs' });
        }

        if (urls.length > 5) {
            return res.status(400).json({ success: false, message: 'Chỉ được thu thập tối đa 5 URLs mỗi lần' });
        }

        const result = await crawlService.processLegalCrawl(urls, global.io);

        res.json({ success: true, ...result });

    } catch (error) {
        console.error(' [CRITICAL ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ============================================================
// MODULE 3: LẤY DANH SÁCH NGƯỜI DÙNG (ADMIN)
// ============================================================
const getAllUsers = async (req, res) => {
    try {
        await poolConnect;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
        const offset = (page - 1) * limit;

        const countRequest = pool.request();
        const countSql = `SELECT COUNT(*) as total FROM dbo.Users`;
        const countResult = await countRequest.query(countSql);
        const totalUsers = countResult.recordset[0]?.total || 0;

        const dataRequest = pool.request();
        dataRequest.input('Offset', sql.Int, offset);
        dataRequest.input('Limit', sql.Int, limit);
        const query = `
            SELECT Id, FullName, Email, Role, Status, CreatedAt
            FROM dbo.Users
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;
        const result = await dataRequest.query(query);

        res.json({
            success: true,
            data: result.recordset,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách User:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu người dùng' });
    }
};

const toggleUserBan = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId) return res.status(400).json({ success: false, message: 'User id required' });

        await poolConnect;
        const request = pool.request();
        request.input('Id', sql.Int, userId);

        const updateSql = `
            UPDATE dbo.Users
            SET Status = CASE WHEN Status = 'Banned' THEN 'Active' ELSE 'Banned' END
            WHERE Id = @Id;
            SELECT Id, FullName, Email, Role, Status, CreatedAt
            FROM dbo.Users
            WHERE Id = @Id;
        `;

        const result = await request.query(updateSql);
        const updatedUser = result.recordset?.[0];
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error(' Lỗi khóa/mở khóa User:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái người dùng' });
    }
};

const createUser = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
        }

        // Kiểm tra email đã tồn tại
        await poolConnect;
        const checkRequest = pool.request();
        checkRequest.input('Email', sql.NVarChar(255), email);
        const checkResult = await checkRequest.query('SELECT Id FROM dbo.Users WHERE Email = @Email');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        // Mã hóa mật khẩu
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Thêm user mới
        const insertRequest = pool.request();
        insertRequest.input('FullName', sql.NVarChar(255), fullName);
        insertRequest.input('Email', sql.NVarChar(255), email);
        insertRequest.input('Password', sql.NVarChar(255), hashedPassword);
        insertRequest.input('Role', sql.NVarChar(50), role || 'USER');
        insertRequest.input('Status', sql.NVarChar(50), 'Active');
        insertRequest.input('CreatedAt', sql.DateTime, new Date());

        const insertSql = `
            INSERT INTO dbo.Users (FullName, Email, Password, Role, Status, CreatedAt)
            VALUES (@FullName, @Email, @Password, @Role, @Status, @CreatedAt)
            RETURNING Id
        `;

        const insertResult = await insertRequest.query(insertSql);
        const newUserId = insertResult.recordset[0].Id;

        res.json({ success: true, message: 'Thêm người dùng thành công', userId: newUserId });
    } catch (error) {
        console.error(' Lỗi tạo user:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tạo người dùng' });
    }
};
const getAiHistory = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
        const offset = (page - 1) * limit;

        await poolConnect;

        // 1. Đếm tổng số records từ bảng ContractHistory (Bao quát 5 chức năng AI)
        const countRequest = pool.request();
        const countSql = `SELECT COUNT(*) AS total FROM [dbo].[ContractHistory]`;
        const countResult = await countRequest.query(countSql);
        const totalItems = countResult.recordset[0]?.total || 0;

        const historyRequest = pool.request();
        historyRequest.input('Offset', sql.Int, offset);
        historyRequest.input('Limit', sql.Int, limit);

        // 2. Truy vấn dữ liệu tập trung từ ContractHistory JOIN với Users
        const query = `
            SELECT 
                h.Id, 
                u.FullName, 
                u.Email, 
                h.RecordType, 
                h.Status as Outcome, 
                h.CreatedAt as EventTime,
                h.Title,
                h.FileName
            FROM [dbo].[ContractHistory] h
            LEFT JOIN [dbo].[Users] u ON h.UserId = u.Id
            ORDER BY h.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `;
        const result = await historyRequest.query(query);

        // 3. Bộ Mapping chuyển đổi RecordType sang tên hiển thị Tiếng Việt
        // adminController.js

        const featureLabels = {
            // Các key 
            'CONTRACT': 'Phân tích Hợp đồng',
            'CHATBOT': 'Chatbot Tư vấn',
            'PLANNING': 'Lập Kế hoạch AI',
            'FORM_GEN': 'Sinh Biểu mẫu',
            'VIDEO_ANALYSIS': 'Phân tích Video',
            'VIDEO': 'Phân tích Video',
            'FORM': 'Sinh Biểu mẫu',
            'ANALYSIS': 'Phân tích Hợp đồng'
        };

        // Thêm trường DisplayName dựa trên mapping
        const mappedData = result.recordset.map(item => ({
            ...item,
            DisplayName: featureLabels[item.RecordType] || item.RecordType
        }));

        res.json({
            success: true,
            data: mappedData,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems
        });
    } catch (error) {
        console.error(' Lỗi lấy Lịch sử Phân tích AI:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử phân tích AI' });
    }
};
// Hàm lấy tính năng được sử dụng nhiều nhất (Dựa trên bảng AIFeatureUsage)
const getFeatureUsage = async (req, res) => {
    try {
        const timeframe = String(req.query.timeframe || req.query.filter || 'week').toLowerCase();

        let whereClause = `WHERE CreatedAt >= DATEADD(WEEK, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;

        if (timeframe === 'month') {
            whereClause = `WHERE CreatedAt >= DATEADD(MONTH, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;
        } else if (timeframe === 'year') {
            whereClause = `WHERE CreatedAt >= DATEADD(YEAR, -1, GETDATE()) AND FeatureName != 'CRAWL_DATA'`;
        } else if (timeframe === 'all') {
            whereClause = `WHERE FeatureName != 'CRAWL_DATA'`;
        }

        await poolConnect;
        const request = pool.request();
        const query = `
            SELECT
                FeatureName,
                SUM(UsageCount) AS UsageCount
            FROM [LegalBotDB].[dbo].[AIFeatureUsage]
            ${whereClause}
            GROUP BY FeatureName
            ORDER BY UsageCount DESC LIMIT 10
        `;

        const result = await request.query(query);

        res.json({ success: true, data: result.recordset || [], timeframe });
    } catch (error) {
        console.error(' Lỗi lấy Tính năng Sử dụng Nhiều nhất:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
const getCrawlerStatus = async (req, res) => {
    try {
        const status = crawlService.getCrawlStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error(' [GET CRAWLER STATUS ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy trạng thái crawler',
            error: error.message
        });
    }
};
// adminController.js

const toggleSaveLaw = async (req, res) => {
    try {
        // Bốc đủ Metadata từ body để lưu vào DB
        const { documentId, documentTitle, documentNumber, issueYear } = req.body;
        const userId = req.user.id;

        if (!documentId) return res.status(400).json({ success: false, message: 'Thiếu DocumentId' });

        await poolConnect;
        const request = pool.request();
        request.input('UserId', sql.BigInt, userId);
        request.input('DocumentId', sql.NVarChar(500), documentId);
        request.input('DocumentTitle', sql.NVarChar(500), documentTitle);
        request.input('DocumentNumber', sql.NVarChar(100), documentNumber || '');
        request.input('IssueYear', sql.Int, issueYear || null);

        const existing = await request.query(
            `SELECT Id FROM UserSavedLaws WHERE UserId = @UserId AND DocumentId = @DocumentId`
        );

        let action;
        if (existing.recordset.length > 0) {
            await request.query(
                `DELETE FROM UserSavedLaws WHERE UserId = @UserId AND DocumentId = @DocumentId`
            );
            action = 'Removed';
        } else {
            await request.query(
                `INSERT INTO UserSavedLaws (UserId, DocumentId, DocumentTitle, DocumentNumber, IssueYear)
                 VALUES (@UserId, @DocumentId, @DocumentTitle, @DocumentNumber, @IssueYear)`
            );
            action = 'Added';
        }

        res.json({ success: true, action });
    } catch (error) {
        console.error('Lỗi toggle save law:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const recordRecentView = async (req, res) => {
    try {
        const { documentId, documentTitle, documentNumber, issueYear } = req.body;
        const userId = req.user.id; // Lấy userId từ token

        if (!documentId || typeof documentId !== 'string') {
            return res.status(400).json({ success: false, message: 'DocumentId phải là chuỗi hợp lệ' });
        }

        await poolConnect;
        const request = pool.request();
        request.input('UserId', sql.BigInt, userId);
        request.input('DocumentId', sql.NVarChar(500), documentId);
        request.input('ViewedAt', sql.DateTime, new Date());
        request.input('DocumentTitle', sql.NVarChar(sql.MAX), documentTitle);
        request.input('DocumentNumber', sql.NVarChar(50), documentNumber);
        request.input('IssueYear', sql.Int, issueYear);
        const query = `
            WITH upd AS (
                UPDATE UserRecentlyViewed
                SET ViewedAt = @ViewedAt
                WHERE UserId = @UserId AND DocumentId = @DocumentId
                RETURNING Id
            )
            INSERT INTO UserRecentlyViewed (UserId, DocumentId, ViewedAt, DocumentTitle, DocumentNumber, IssueYear)
            SELECT @UserId, @DocumentId, @ViewedAt, @DocumentTitle, @DocumentNumber, @IssueYear
            WHERE NOT EXISTS (SELECT 1 FROM upd)
        `;

        await request.query(query);

        res.json({ success: true, message: 'Ghi nhận lượt xem thành công' });
    } catch (error) {
        console.error('Lỗi khi record recent view:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi ghi nhận lượt xem' });
    }
};
// adminController.js

// adminController.js
const getRandomLawyers = async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request().query(
            "SELECT FullName, Phone, Specialty FROM Lawyers WHERE IsActive = 1 ORDER BY NEWID() LIMIT 1"
        );
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

module.exports = {
    getSystemStats,
    getSystemSettings,
    crawlAndSyncLaw,
    runManualCrawl,
    getRecentHistory,
    getCrawlerSettings,
    updateCrawlerSettings,
    getAllUsers,
    createUser,
    toggleUserBan,
    getAiHistory,
    getFeatureUsage,
    getCrawlerStatus,
    toggleSaveLaw,
    recordRecentView,
    getRandomLawyers
};