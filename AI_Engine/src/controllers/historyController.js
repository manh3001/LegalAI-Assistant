const { sql, pool, poolConnect } = require('../config/db');

// 1. Lưu kết quả phân tích
// 1. Lưu kết quả phân tích (Đã thêm Title và RecordType)
exports.saveAnalysis = async (req, res) => {
  try {
    // Nhận thêm title và recordType từ Frontend gửi lên
    const { userId, fileName, riskScore, content, title, recordType } = req.body;

    if (!userId || !fileName) {
      return res.status(400).json({ success: false, message: 'userId and fileName required' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);
    request.input('FileName', sql.NVarChar(260), fileName);
    request.input('Title', sql.NVarChar(500), title ?? `Hồ sơ: ${fileName}`); // Lưu tiêu đề đẹp
    request.input('RecordType', sql.NVarChar(50), recordType ?? 'ANALYSIS');   // Phân loại hồ sơ
    request.input('RiskScore', sql.Int, riskScore ?? null);
    request.input('AnalysisJson', sql.NVarChar(sql.MAX), content ?? null);
    request.input('AnalysisAt', sql.DateTime2, new Date());

    // Cập nhật câu lệnh INSERT đầy đủ các cột
    const insertSql = `
      INSERT INTO dbo.ContractHistory (UserId, FileName, Title, RecordType, AnalysisAt, RiskScore, AnalysisJson, CreatedAt)
      OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.Title, INSERTED.RecordType, INSERTED.RiskScore, INSERTED.AnalysisAt
      VALUES (@UserId, @FileName, @Title, @RecordType, @AnalysisAt, @RiskScore, @AnalysisJson, SYSUTCDATETIME())
    `;

    const result = await request.query(insertSql);
    const row = result.recordset[0];

    console.log(`✅ Đã lưu ${recordType} cho User ${userId}`);
    return res.json({ success: true, analysis: row });

  } catch (err) {
    console.error('Save Analysis Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// 2. Lấy danh sách lịch sử theo User (CÓ PHÂN TRANG & TÌM KIẾM)
exports.getHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Lấy thêm query params từ Frontend gửi lên (mặc định trang 1, mỗi trang 6 item)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6; 
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    await poolConnect;
    const request = pool.request();
    request.input('UserId', sql.BigInt, userId);

    // Điều kiện lọc cơ bản
    let whereClause = `WHERE UserId = @UserId`;
    
    // Nếu có tìm kiếm thì ghép thêm điều kiện LIKE
    if (search.trim() !== '') {
        whereClause += ` AND (Title LIKE @Search OR FileName LIKE @Search)`;
        request.input('Search', sql.NVarChar, `%${search}%`);
    }

    // 1. Lấy TỔNG SỐ record để Frontend chia trang
    const countSql = `SELECT COUNT(*) as total FROM dbo.ContractHistory ${whereClause}`;
    const countResult = await request.query(countSql);
    const totalDocs = countResult.recordset[0].total;

    // 2. Lấy DATA của đúng trang hiện tại
    const selectSql = `
        SELECT * FROM dbo.ContractHistory 
        ${whereClause} 
        ORDER BY CreatedAt DESC 
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;
    const result = await request.query(selectSql);

    return res.json({ 
        success: true, 
        data: result.recordset,
        currentPage: page,
        totalPages: Math.ceil(totalDocs / limit),
        totalDocs: totalDocs
    });
  } catch (err) {
    console.error('Get History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Lấy chi tiết 1 hồ sơ (MỚI)
exports.getDetail = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const sqlText = `SELECT * FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(sqlText);

    const row = result.recordset && result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('Get Detail Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Xóa hồ sơ (MỚI)
exports.deleteHistory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.BigInt, id);

    const deleteSql = `DELETE FROM dbo.ContractHistory WHERE Id = @Id`;
    const result = await request.query(deleteSql);

    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) {
      return res.status(404).json({ success: false, message: 'Not found or already deleted' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách Luật đã lưu của người dùng
exports.getSavedLaws = async (req, res) => {
    const userId = req.params.userId; 
    if (!userId) {
        return res.status(400).json({ success: false, message: "userId required in URL params." });
    }

    try {
        await poolConnect; 
        const request = pool.request();
        // Sửa lỗi: Gán kết quả của truy vấn vào biến 'result'
        const result = await request
            .input('userId', sql.BigInt, userId)
            .query(`
                SELECT 
                    Id, 
                    DocumentId, 
                    DocumentTitle AS Title, 
                    DocumentNumber, 
                    IssueYear,
                    SavedAt
                FROM [dbo].[UserSavedLaws]
                WHERE UserId = @userId
                ORDER BY SavedAt DESC;
            `);
        
        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("❌ Lỗi khi lấy luật đã lưu:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy luật đã lưu." });
    }
};

// THÊM/XÓA LUẬT VÀO DANH SÁCH ĐÃ LƯU
exports.toggleSavedLaw = async (req, res) => {
    const { userId, DocumentId, DocumentTitle, DocumentNumber, IssueYear } = req.body;

    if (!userId || !DocumentId || !DocumentTitle) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin người dùng hoặc văn bản." });
    }

    if (DocumentId.length > 255 || DocumentTitle.length > 500 || (DocumentNumber && DocumentNumber.length > 100)) {
        return res.status(400).json({ success: false, message: "Thông tin văn bản quá dài." });
    }

    try {
        await poolConnect; 
        
        // Luôn tạo một request mới cho mỗi thao tác chính để tránh lỗi trùng lặp tham số
        const checkRequest = pool.request();
        checkRequest.input('userId', sql.BigInt, userId);
        checkRequest.input('documentId', sql.NVarChar(255), DocumentId);

        // 1. Kiểm tra xem luật đã tồn tại trong danh sách đã lưu của user chưa
        const checkResult = await checkRequest.query(`
            SELECT Id FROM [dbo].[UserSavedLaws] 
            WHERE UserId = @userId AND DocumentId = @documentId;
        `);

        if (checkResult.recordset.length > 0) {
            // Nếu đã tồn tại, thì xóa đi (toggle off)
            const deleteRequest = pool.request();
            await deleteRequest
                .input('savedLawId', sql.BigInt, checkResult.recordset[0].Id) 
                .query(`DELETE FROM [dbo].[UserSavedLaws] WHERE Id = @savedLawId;`);
            res.json({ success: true, action: "removed", message: "Đã xóa luật khỏi danh sách lưu." });
        } else {
            // Nếu chưa tồn tại, thì thêm mới (toggle on)
            const insertRequest = pool.request();
            await insertRequest
                .input('userId', sql.BigInt, userId)
                .input('documentId', sql.NVarChar(255), DocumentId)
                .input('documentTitle', sql.NVarChar(500), DocumentTitle)
                .input('documentNumber', sql.NVarChar(100), DocumentNumber)
                .input('issueYear', sql.Int, IssueYear)
                .query(`
                    INSERT INTO [dbo].[UserSavedLaws] 
                        (UserId, DocumentId, DocumentTitle, DocumentNumber, IssueYear)
                    VALUES 
                        (@userId, @documentId, @documentTitle, @documentNumber, @issueYear);
                `);
            res.json({ success: true, action: "added", message: "Đã thêm luật vào danh sách lưu." });
        }

    } catch (error) {
        console.error("❌ Lỗi khi thêm/xóa luật đã lưu:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật luật đã lưu." });
    }
};

// Lấy danh sách tài liệu vừa xem gần đây của người dùng
exports.getRecentDocs = async (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.status(400).json({ success: false, message: "userId required in URL params." });
    }

    try {
        await poolConnect; 
        const request = pool.request();
        // Sửa lỗi: Gán kết quả của truy vấn vào biến 'result'
        const result = await request
            .input('userId', sql.BigInt, userId)
            .query(`
                SELECT TOP 8 
                    Id, 
                    DocumentId, 
                    DocumentTitle AS Title, 
                    DocumentNumber, 
                    IssueYear,
                    ViewedAt
                FROM [dbo].[UserRecentlyViewed]
                WHERE UserId = @userId
                ORDER BY ViewedAt DESC;
            `);
        
        res.json({ success: true, data: result.recordset });

    } catch (error) {
        console.error("❌ Lỗi khi lấy tài liệu xem gần đây:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy tài liệu xem gần đây." });
    }
};

// THÊM/CẬP NHẬT TÀI LIỆU VÀO LỊCH SỬ XEM GẦN ĐÂY
exports.addRecentDoc = async (req, res) => {
    const { userId, DocumentId, DocumentTitle, DocumentNumber, IssueYear } = req.body;

    if (!userId || !DocumentId || !DocumentTitle) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin người dùng hoặc văn bản." });
    }

    if (DocumentId.length > 255 || DocumentTitle.length > 500 || (DocumentNumber && DocumentNumber.length > 100)) {
        return res.status(400).json({ success: false, message: "Thông tin văn bản quá dài." });
    }

    try {
        await poolConnect; 
        
        // Luôn tạo một request mới cho mỗi thao tác chính để tránh lỗi trùng lặp tham số
        const checkRequest = pool.request();
        checkRequest.input('userId', sql.BigInt, userId);
        checkRequest.input('documentId', sql.NVarChar(255), DocumentId);

        const checkResult = await checkRequest
            .query(`SELECT Id FROM [dbo].[UserRecentlyViewed] WHERE UserId = @userId AND DocumentId = @documentId;`);

        if (checkResult.recordset.length > 0) {
            // Nếu đã tồn tại, cập nhật thời gian xem
            const updateRequest = pool.request();
            await updateRequest
                .input('recentDocId', sql.BigInt, checkResult.recordset[0].Id) 
                .query(`UPDATE [dbo].[UserRecentlyViewed] SET ViewedAt = SYSUTCDATETIME() WHERE Id = @recentDocId;`);
            res.json({ success: true, action: "updated", message: "Đã cập nhật thời gian xem." });
        } else {
            // Nếu chưa tồn tại, thêm mới
            const insertRequest = pool.request();
            await insertRequest
                .input('userId', sql.BigInt, userId)
                .input('documentId', sql.NVarChar(255), DocumentId)
                .input('documentTitle', sql.NVarChar(500), DocumentTitle)
                .input('documentNumber', sql.NVarChar(100), DocumentNumber)
                .input('issueYear', sql.Int, IssueYear)
                .query(`
                    INSERT INTO [dbo].[UserRecentlyViewed] 
                        (UserId, DocumentId, DocumentTitle, DocumentNumber, IssueYear)
                    VALUES 
                        (@userId, @documentId, @documentTitle, @documentNumber, @issueYear);
                `);
            res.json({ success: true, action: "added", message: "Đã thêm vào lịch sử xem gần đây." });
        }

    } catch (error) {
        console.error("❌ Lỗi khi thêm/cập nhật tài liệu xem gần đây:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật lịch sử xem gần đây." });
    }
};

// XÓA TÀI LIỆU KHỎI LỊCH SỬ XEM GẦN ĐÂY
exports.removeRecentDoc = async (req, res) => {
    const { userId, recentDocId } = req.body; 

    if (!userId || !recentDocId) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin người dùng hoặc ID bản ghi lịch sử." });
    }

    try {
        await poolConnect; // Đảm bảo pool đã được kết nối
        const request = pool.request(); // Sử dụng pool đã được export
        
        const result = await request
            .input('userId', sql.BigInt, userId)
            .input('recentDocId', sql.BigInt, recentDocId)
            .query(`DELETE FROM [dbo].[UserRecentlyViewed] WHERE Id = @recentDocId AND UserId = @userId;`);

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: "Đã xóa khỏi lịch sử xem gần đây." });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy bản ghi hoặc bạn không có quyền xóa." });
        }

    } catch (error) {
        console.error("❌ Lỗi khi xóa tài liệu xem gần đây:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi xóa lịch sử xem gần đây." });
    }
};

// XÓA MỘT LUẬT ĐÃ LƯU THEO ID 
exports.removeSavedLaw = async (req, res) => {
    const { userId, savedLawId } = req.body; 

    if (!userId || !savedLawId) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin người dùng hoặc ID bản ghi luật đã lưu." });
    }

    try {
        await poolConnect; 
        const request = pool.request();
        
        const result = await request
            .input('userId', sql.BigInt, userId)
            .input('savedLawId', sql.BigInt, savedLawId)
            .query(`DELETE FROM [dbo].[UserSavedLaws] WHERE Id = @savedLawId AND UserId = @userId;`);

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: "Đã xóa luật khỏi danh sách lưu." });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy bản ghi hoặc bạn không có quyền xóa." });
        }

    } catch (error) {
        console.error("❌ Lỗi khi xóa luật đã lưu:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi xóa luật đã lưu." });
    }
};