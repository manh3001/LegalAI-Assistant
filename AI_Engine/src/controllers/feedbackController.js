const { sql, pool, poolConnect } = require('../config/db');
const mailService = require('../services/mailService');

/**
 * POST /api/feedback
 * Người dùng gửi phản hồi - tự động lấy UserId từ authMiddleware
 * body: { name, email, type, rating, content }
 */
exports.createFeedback = async (req, res) => {
    try {
        const { name, email, type, rating, content } = req.body;
        const userId = req.user.id; // Lấy từ authMiddleware

        // Validate trường bắt buộc
        if (!name || !email || !type || !content) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ tên, email, loại phản hồi và nội dung.'
            });
        }

        // Validate email format cơ bản
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ.'
            });
        }

        await poolConnect;
        const request = pool.request();

        request.input('UserId', sql.BigInt, userId);
        request.input('Name', sql.NVarChar(200), name.trim());
        request.input('Email', sql.NVarChar(320), email.trim());
        request.input('Type', sql.NVarChar(100), type.trim());
        request.input('Rating', sql.Int, rating || 0);
        request.input('Content', sql.NVarChar(sql.MAX), content.trim());
        request.input('Status', sql.NVarChar(20), 'Pending');

        const insertSql = `
            INSERT INTO dbo.Feedbacks (UserId, Name, Email, Type, Rating, Content, Status, CreatedAt)
            VALUES (@UserId, @Name, @Email, @Type, @Rating, @Content, @Status, GETDATE())
        `;

        await request.query(insertSql);

        return res.status(201).json({
            success: true,
            message: 'Gửi phản hồi thành công! Cảm ơn ý kiến đóng góp của bạn.'
        });
    } catch (error) {
        console.error('Lỗi trong createFeedback:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi gửi phản hồi.'
        });
    }
};

/**
 * GET /api/admin/feedback
 * Admin lấy toàn bộ phản hồi, sắp xếp theo CreatedAt DESC
 * Response: camelCase format
 */
exports.getFeedbacks = async (req, res) => {
    try {
        await poolConnect;
        const request = pool.request();

        const selectSql = `
            SELECT 
                Id as id,
                UserId as userId,
                Name as name,
                Email as email,
                Type as type,
                Rating as rating,
                Content as content,
                Status as status,
                ReplyContent as replyContent,
                CreatedAt as createdAt
            FROM dbo.Feedbacks
            ORDER BY CreatedAt DESC
        `;

        const result = await request.query(selectSql);

        return res.status(200).json({
            success: true,
            data: result.recordset || [],
            count: (result.recordset || []).length
        });
    } catch (error) {
        console.error('Lỗi trong getFeedbacks:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách phản hồi.'
        });
    }
};

/**
 * PUT /api/admin/feedback/status
 * Admin cập nhật trạng thái phản hồi
 * body: { id, status }
 */
exports.updateStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id || !status) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ID phản hồi và trạng thái mới.'
            });
        }

        // Validate status values
        const validStatuses = ['Pending', 'Processing', 'Resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ. Các giá trị hợp lệ: Pending, Processing, Resolved'
            });
        }

        await poolConnect;
        const request = pool.request();

        request.input('Id', sql.Int, id);
        request.input('Status', sql.NVarChar(20), status);

        const updateSql = `
            UPDATE dbo.Feedbacks
            SET Status = @Status
            WHERE Id = @Id
        `;

        const result = await request.query(updateSql);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phản hồi với ID này.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Cập nhật trạng thái thành công.'
        });
    } catch (error) {
        console.error('Lỗi trong updateStatus:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái.'
        });
    }
};

/**
 * POST /api/admin/feedback/reply
 * Admin gửi email trả lời khách hàng
 * body: { id, replyContent }
 */
exports.replyFeedback = async (req, res) => {
    try {
        const { id, replyContent } = req.body;

        if (!id || !replyContent) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ID phản hồi và nội dung trả lời.'
            });
        }

        await poolConnect;
        const request = pool.request();

        // 1. Lấy thông tin phản hồi từ database
        request.input('Id', sql.Int, id);
        const selectSql = `
            SELECT Email, Name, Content, Status
            FROM dbo.Feedbacks
            WHERE Id = @Id
        `;

        const result = await request.query(selectSql);
        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phản hồi với ID này.'
            });
        }

        const feedback = result.recordset[0];
        const userEmail = feedback.Email;
        const userName = feedback.Name;

        // 2. Cập nhật ReplyContent và Status trong database
        const updateRequest = pool.request();
        updateRequest.input('Id', sql.Int, id);
        updateRequest.input('ReplyContent', sql.NVarChar(sql.MAX), replyContent.trim());
        updateRequest.input('Status', sql.NVarChar(20), 'Resolved');

        const updateSql = `
            UPDATE dbo.Feedbacks
            SET ReplyContent = @ReplyContent, Status = @Status
            WHERE Id = @Id
        `;

        await updateRequest.query(updateSql);

        // 3. Gửi email trả lời
        try {
            const mailOptions = {
                from: `"LegAI Hub" <${process.env.MAIL_FROM_ADDRESS}>`,
                to: userEmail,
                subject: '[LegAI Hub] Ban quản trị phản hồi ý kiến đóng góp của bạn',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; background-color: #f9f9f9;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #B8985D; margin: 0;">LegAI Hub</h2>
                            <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">Hệ thống Hỗ trợ Pháp lý Thông minh</p>
                        </div>
                        <hr style="border: none; border-top: 2px solid #B8985D; margin: 20px 0;" />
                        
                        <p>Xin chào <strong>${userName}</strong>,</p>
                        <p>Ban quản trị LegAI đã tiếp nhận phản hồi của bạn. Nội dung xử lý/phản hồi chi tiết:</p>
                        
                        <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #B8985D; margin: 20px 0; border-radius: 5px;">
                            <p style="margin: 0; color: #1a2530; line-height: 1.6;">${replyContent}</p>
                        </div>
                        
                        <p style="font-size: 13px; color: #6b7280;">Trân trọng cảm ơn bạn đã tin tưởng và gửi các ý kiến quý báu đóng góp cho chúng tôi. Nếu bạn có thêm câu hỏi, vui lòng truy cập trang liên hệ hoặc gửi email cho chúng tôi.</p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
                            <p style="margin: 0;">&copy; 2026 LegAI Hub - Hệ Thống Pháp Lý Thông Minh</p>
                            <p style="margin: 5px 0; color: #b3b3b3;">Cần trợ giúp? Hãy liên hệ: support@legai.vn</p>
                        </div>
                    </div>
                `
            };

            await mailService.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Lỗi khi gửi email:', emailError.message);
            // Không trả về lỗi, chỉ log vì đã cập nhật database thành công
        }

        return res.status(200).json({
            success: true,
            message: 'Email trả lời đã được gửi thành công đến người dùng.'
        });
    } catch (error) {
        console.error('Lỗi trong replyFeedback:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi gửi email trả lời.'
        });
    }
};
