const { sql, pool, poolConnect } = require('../config/db');

// 1. Lưu kết quả phân tích

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

    console.log(` Đã lưu ${recordType} cho User ${userId}`);
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

// 3. Lấy chi tiết 1 hồ sơ 
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
// 5. Cập nhật hồ sơ 
exports.updateHistory = async (req, res) => {
  try {
    const id = req.params.id;
    // Lấy 'name' và 'description' từ Frontend gửi lên
    const { name, description } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'id required' });
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tên hồ sơ không được để trống' });
    }

    await poolConnect;
    const request = pool.request();

    // Gán tham số
    request.input('Id', sql.BigInt, id);
    request.input('Title', sql.NVarChar(500), name);
    request.input('Description', sql.NVarChar(sql.MAX), description || ''); // Nếu không có mô tả thì lưu chuỗi rỗng

    // Câu lệnh Update: Sửa Tên, Mô tả và Cập nhật luôn giờ sửa đổi (UpdatedAt)
    const updateSql = `
      UPDATE dbo.ContractHistory 
      SET Title = @Title, 
          Description = @Description,
          UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @Id
    `;

    const result = await request.query(updateSql);

    // Kiểm tra xem có update thành công không
    const affected = result.rowsAffected && result.rowsAffected[0];
    if (!affected || affected === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc không thể cập nhật' });
    }

    return res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    console.error('Update History Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// ============================================================================
// 6. Lưu Video Analysis vào ContractHistory (USER CLICK SAVE)
// ============================================================================
exports.saveVideoAnalysis = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ FIX SECURITY
    const { videoUrl, title, analysisData } = req.body;

    if (!videoUrl || !analysisData) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu (videoUrl, analysisData)'
      });
    }

    await poolConnect;

    // =============================
    // 1. CHECK DUPLICATE (CHUẨN)
    // =============================
    const checkRequest = pool.request();
    checkRequest.input('UserId', sql.BigInt, userId);
    checkRequest.input('VideoUrl', sql.NVarChar(500), videoUrl);

    const existing = await checkRequest.query(`
      SELECT TOP 1 Id FROM ContractHistory
      WHERE UserId = @UserId 
      AND VideoUrl = @VideoUrl 
      AND RecordType = 'VIDEO_ANALYSIS'
    `);

    if (existing.recordset.length > 0) {
      return res.json({
        success: true,
        message: 'Video đã được lưu trước đó',
        duplicate: true
      });
    }

    // =============================
    // 2. EXTRACT DATA
    // =============================
    const finalTitle = title || videoUrl;

    const riskScore =
      analysisData.trustScore ||
      analysisData.audit_metrics?.trust_score ||
      0;

    const summary =
      analysisData.summary ||
      analysisData.analysis_report ||
      '';

    // =============================
    // 3. INSERT
    // =============================
    const request = pool.request();

    request.input('UserId', sql.BigInt, userId);
    request.input('Title', sql.NVarChar(500), finalTitle);
    request.input('VideoUrl', sql.NVarChar(500), videoUrl); // ✅ FIX
    request.input('RecordType', sql.NVarChar(50), 'VIDEO_ANALYSIS');
    request.input('RiskScore', sql.Int, riskScore);
    request.input('AnalysisText', sql.NVarChar(sql.MAX), summary);
    request.input('AnalysisJson', sql.NVarChar(sql.MAX), JSON.stringify(analysisData));
    request.input('CreatedAt', sql.DateTime2, new Date());

    const insertSql = `
      INSERT INTO dbo.ContractHistory
      (UserId, Title, VideoUrl, RecordType, RiskScore, AnalysisText, AnalysisJson, CreatedAt, IsFinal)
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.RecordType, INSERTED.CreatedAt
      VALUES
      (@UserId, @Title, @VideoUrl, @RecordType, @RiskScore, @AnalysisText, @AnalysisJson, @CreatedAt, 1)
    `;

    const result = await request.query(insertSql);
    const saved = result.recordset[0];

    // =============================
    // 4. SOCKET (OPTIONAL - CẨN THẬN DUPLICATE)
    // =============================
    if (global.io) {
      global.io.emit('new_ai_history', {
        Id: saved.Id,
        FeatureName: 'VIDEO_ANALYSIS',
        Outcome: 'Thành công',
        EventTime: new Date(),
        UserId: userId
      });
    }

    console.log(`📁 User ${userId} đã lưu video`);

    return res.json({
      success: true,
      message: 'Lưu video thành công',
      data: saved
    });

  } catch (err) {
    console.error('Save Video Analysis Error:', err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};