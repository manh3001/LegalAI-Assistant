const { sql, pool, poolConnect } = require('../config/db');

/**
 * GET /api/documents
 * Lấy danh sách văn bản có Phân trang & Lọc
 */
exports.getAllDocuments = async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();

    // 1. Lấy và làm sạch tham số từ URL
    const rawSearch = req.query.search || '';
    const search = rawSearch.replace(/\s+/g, ' ').trim();
    const category = (req.query.category || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Xây dựng bộ lọc WHERE
    let whereClause = ` WHERE 1=1 `;

    if (search) {
      const keywords = search.split(' ').filter(Boolean);
      const keywordConditions = keywords.map((keyword, index) => {
        const paramName = `searchTerm${index}`;
        request.input(paramName, sql.NVarChar, `%${keyword}%`);
        return `(Title LIKE @${paramName} OR DocumentNumber LIKE @${paramName})`;
      });
      whereClause += ` AND ${keywordConditions.join(' AND ')}`;
    }

    // Nếu category không phải là rỗng và không phải các nhãn "Tất cả"
    if (category && category !== 'Tất cả' && category !== 'Xem tất cả') {
      whereClause += ` AND Category = @category`;
      request.input('category', sql.NVarChar, category);
    }

    // 3. Thực hiện đếm tổng số bản ghi (Phải đếm dựa trên bộ lọc WHERE ở trên)
    const countResult = await request.query(`SELECT COUNT(*) as Total FROM LegalDocuments ${whereClause}`);
    const totalDocs = countResult.recordset[0].Total;

    // 4. Lấy dữ liệu trang hiện tại
    // Dùng input cho offset và limit để an toàn tuyệt đối
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const sqlText = `
      SELECT Id, Title, DocumentNumber, IssueYear, Status, Category 
      FROM LegalDocuments 
      ${whereClause}
      ORDER BY IssueYear DESC, CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await request.query(sqlText);

    // 5. Trả về format chuẩn để Frontend nhảy số trang
    return res.json({
      success: true,
      data: result.recordset,
      totalDocs: totalDocs,
      totalPages: Math.ceil(totalDocs / limit),
      currentPage: page,
      limit: limit
    });

  } catch (err) {
    console.error('GetAllDocuments Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/document-stats
 * Lấy số lượng thực tế để nhảy số trên Sidebar
 */
exports.getDocumentStats = async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();

    // Lấy stats theo từng nhóm
    const statsResult = await request.query(`
      SELECT Category, COUNT(*) as Count 
      FROM LegalDocuments 
      GROUP BY Category
    `);

    // Lấy tổng số lượng
    const totalResult = await request.query(`SELECT COUNT(*) as Total FROM LegalDocuments`);

    return res.json({
      success: true,
      stats: statsResult.recordset,
      total: totalResult.recordset[0].Total
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/documents/:id
 */
exports.getDocumentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    await poolConnect;
    const request = pool.request();

    request.input('Id', sql.NVarChar(100), id);
    const result = await request.query(`SELECT * FROM dbo.LegalDocuments WHERE Id = @Id`);

    if (!result.recordset[0]) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy văn bản' });
    }

    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};