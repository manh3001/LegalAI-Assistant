const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: process.env.MAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
    },
});


// Hàm chung gửi email với tùy chọn
exports.sendMail = async (mailOptions) => {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('Send Email Error:', error);
        throw error;
    }
};

exports.sendResetEmail = async (to, pin) => {
    try {
        const mailOptions = {
            from: `"${process.env.MAIL_FROM_NAME || 'LegAI Support'}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to: to,
            subject: 'Mã PIN khôi phục mật khẩu - LegAI Platform',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4f46e5;">LegAI Platform</h2>
                        <p style="color: #6b7280; font-size: 14px;">Hệ thống Hỗ trợ Pháp lý Thông minh</p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <div style="padding: 20px 0;">
                        <p>Chào bạn,</p>
                        <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với email này. Để tiếp tục, vui lòng sử dụng mã PIN dưới đây:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="display: inline-block; padding: 10px 20px; background-color: #f3f4f6; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; border: 1px solid #d1d5db;">
                                ${pin}
                            </span>
                        </div>
                        
                        <p style="font-size: 13px; color: #ef4444; font-weight: bold;">⚠️ Lưu ý: Mã PIN này sẽ hết hạn trong vòng 15 phút.</p>
                        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ nếu bạn lo ngại về bảo mật.</p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
                        <p>&copy; 2026 DATN_DTU_2026 - Powered by Gemini AI</p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(' Email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error(' Send Email Error:', error);
        throw error;
    }
};
