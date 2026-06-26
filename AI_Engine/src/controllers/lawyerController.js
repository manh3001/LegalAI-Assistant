const { pool, poolConnect } = require('../config/db');

exports.getLawyers = async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT Id, FullName, Phone, Specialty
            FROM dbo.Lawyers
            WHERE IsActive = 1
        `);

        return res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách luật sư:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};

exports.getRandomLawyer = async (req, res) => {
    try {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT Id, FullName, Phone, Specialty
            FROM dbo.Lawyers
            WHERE IsActive = 1
            ORDER BY NEWID() LIMIT 1
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không có luật sư nào khả dụng'
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Lỗi lấy luật sư ngẫu nhiên:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};