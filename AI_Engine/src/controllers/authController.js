const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, pool, poolConnect } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'DATN_DTU_2026_SECRET_KEY_999';

/**
 * POST /auth/register
 * body: { email, password, fullName }
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    // 1. Băm mật khẩu (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);
    request.input('Password', sql.NVarChar(sql.MAX), hashedPassword);
    request.input('FullName', sql.NVarChar(200), fullName || null);
    request.input('Role', sql.NVarChar(20), 'USER');

    const insertSql = `
      INSERT INTO dbo.Users (Email, Password, FullName, Role)
      OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FullName, INSERTED.Role
      VALUES (@Email, @Password, @FullName, @Role)
    `;

    const result = await request.query(insertSql);
    const user = result.recordset[0];

    // 2. Cấp JWT Token
    const token = jwt.sign(
      { id: user.Id, email: user.Email, role: user.Role },
      JWT_SECRET,
      { expiresIn: '30d' } // Token có thời hạn 30 ngày cho phép người dùng đăng nhập lại mà không cần đăng ký mới trong khoảng thời gian này
    );

    return res.json({ success: true, user, token });
  } catch (err) {
    console.error('Auth Register Error:', err);
    if (err.number === 2627) { // unique constraint
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /auth/login
 * body: { email, password }
 */
exports.login = async (req, res) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, Password, FullName, Role, Status FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userRow = result.recordset[0];

    // 0. Kiểm tra tài khoản có đang bị khóa không
    if (userRow.Status && String(userRow.Status).toLowerCase() === 'banned') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị quản trị viên khóa' });
    }

    // 1. Kiểm tra mật khẩu băm
    const isMatch = await bcrypt.compare(password, userRow.Password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Cấp JWT Token
    const token = jwt.sign(
      { id: userRow.Id, email: userRow.Email, role: userRow.Role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const user = {
      id: userRow.Id,
      email: userRow.Email,
      role: userRow.Role,
      fullName: userRow.FullName,
      status: userRow.Status || 'Active'
    };

    return res.json({ success: true, user, token });
  } catch (err) {
    console.error('Auth Login Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * PUT /users/profile
 * body: { fullName, currentPassword, newPassword }
 */
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.Int, userId);

    const selectSql = `SELECT Id, Email, Password, FullName FROM dbo.Users WHERE Id = @Id`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const userRow = result.recordset[0];
    let passwordToSave = userRow.Password;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, userRow.Password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
      }

      const salt = await bcrypt.genSalt(10);
      passwordToSave = await bcrypt.hash(newPassword, salt);
    }

    const updatedName = fullName && typeof fullName === 'string' && fullName.trim() !== '' ? fullName.trim() : userRow.FullName;
    const updateRequest = pool.request();
    updateRequest.input('Id', sql.Int, userId);
    updateRequest.input('FullName', sql.NVarChar(200), updatedName);
    updateRequest.input('Password', sql.NVarChar(sql.MAX), passwordToSave);

    const updateSql = `
      UPDATE dbo.Users
      SET FullName = @FullName,
          Password = @Password,
          UpdatedAt = GETDATE()
      WHERE Id = @Id;
      SELECT Id, Email, FullName, Role FROM dbo.Users WHERE Id = @Id;
    `;

    const updateResult = await updateRequest.query(updateSql);
    const updatedUser = updateResult.recordset[0];

    return res.json({ success: true, message: 'Thông tin hồ sơ đã được cập nhật.', user: updatedUser });
  } catch (err) {
    console.error('Auth UpdateProfile Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * DELETE /users/account
 * body: { password }
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu để xác nhận.' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('Id', sql.Int, userId);

    const selectSql = `SELECT Id, Password FROM dbo.Users WHERE Id = @Id`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const userRow = result.recordset[0];
    const isMatch = await bcrypt.compare(password, userRow.Password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu xác nhận không chính xác.' });
    }

    const deleteRequest = pool.request();
    deleteRequest.input('Id', sql.Int, userId);
    await deleteRequest.query(`DELETE FROM dbo.Users WHERE Id = @Id`);

    return res.json({ success: true, message: 'Tài khoản đã được xóa thành công.' });
  } catch (err) {
    console.error('Auth DeleteAccount Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * POST /auth/forgot-password
 * body: { email }
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email.' });

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng với email này.' });
    }

    // 1. Tạo mã PIN thực tế 6 chữ số
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Tính thời hạn hết hạn (15 phút từ hiện tại)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    // 3. Lưu PIN và thời hạn vào Database
    const updateRequest = pool.request();
    updateRequest.input('Email', sql.NVarChar(320), email);
    updateRequest.input('Pin', sql.NVarChar(10), pin);
    updateRequest.input('Expires', sql.DateTime2, expires);

    const updateSql = `
        UPDATE dbo.Users 
        SET ResetPin = @Pin, ResetPinExpires = @Expires
        WHERE Email = @Email
    `;
    await updateRequest.query(updateSql);

    // 4. Gửi Email thực tế qua NodeMailer
    await mailService.sendResetEmail(email, pin);

    console.log(`✅ [PROD] Reset Password PIN sent to ${email}`);

    return res.json({
      success: true,
      message: `Mã PIN khôi phục đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư đến (hoặc Spam).`
    });
  } catch (err) {
    console.error('Auth ForgotPassword Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
  }
};

/**
 * POST /auth/reset-password
 * body: { email, pin, newPassword }
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, pin, newPassword } = req.body;

    if (!email || !pin || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ: Email, mã PIN và mật khẩu mới.' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, ResetPin, ResetPinExpires FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    const user = result.recordset[0];

    // 1. Kiểm tra tính hợp lệ của PIN
    if (!user.ResetPin || user.ResetPin !== pin) {
      return res.status(400).json({ success: false, message: 'Mã PIN không chính xác.' });
    }

    // 2. Kiểm tra thời hạn PIN
    if (new Date() > new Date(user.ResetPinExpires)) {
      return res.status(400).json({ success: false, message: 'Mã PIN đã hết hạn (sau 15 phút).' });
    }

    // 3. Băm mật khẩu mới (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Cập nhật mật khẩu và Xóa mã PIN dùng một lần
    const updateRequest = pool.request();
    updateRequest.input('Id', sql.Int, user.Id);
    updateRequest.input('Password', sql.NVarChar(sql.MAX), hashedPassword);

    const updateSql = `
            UPDATE dbo.Users 
            SET Password = @Password, ResetPin = NULL, ResetPinExpires = NULL
            WHERE Id = @Id
        `;
    await updateRequest.query(updateSql);

    console.log(`✅ [PROD] Password reset successful for ${email}`);

    return res.json({
      success: true,
      message: 'Mật khẩu đã được khôi phục thành công. Vui lòng đăng nhập với mật khẩu mới.'
    });
  } catch (err) {
    console.error('Auth ResetPassword Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
  }
};

const mailService = require('../services/mailService');

/**
 * POST /auth/forgot-password
 * body: { email }
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email.' });

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng với email này.' });
    }

    // 1. Tạo mã PIN thực tế 6 chữ số
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Tính thời hạn hết hạn (15 phút từ hiện tại)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    // 3. Lưu PIN và thời hạn vào Database
    const updateRequest = pool.request();
    updateRequest.input('Email', sql.NVarChar(320), email);
    updateRequest.input('Pin', sql.NVarChar(10), pin);
    updateRequest.input('Expires', sql.DateTime2, expires);

    const updateSql = `
        UPDATE dbo.Users 
        SET ResetPin = @Pin, ResetPinExpires = @Expires
        WHERE Email = @Email
    `;
    await updateRequest.query(updateSql);

    // 4. Gửi Email thực tế qua NodeMailer
    await mailService.sendResetEmail(email, pin);

    console.log(`✅ [PROD] Reset Password PIN sent to ${email}`);

    return res.json({
      success: true,
      message: `Mã PIN khôi phục đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư đến (hoặc Spam).`
    });
  } catch (err) {
    console.error('Auth ForgotPassword Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
  }
};

/**
 * POST /auth/reset-password
 * body: { email, pin, newPassword }
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, pin, newPassword } = req.body;

    if (!email || !pin || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ: Email, mã PIN và mật khẩu mới.' });
    }

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, ResetPin, ResetPinExpires FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    const user = result.recordset[0];

    // 1. Kiểm tra tính hợp lệ của PIN
    if (!user.ResetPin || user.ResetPin !== pin) {
      return res.status(400).json({ success: false, message: 'Mã PIN không chính xác.' });
    }

    // 2. Kiểm tra thời hạn PIN
    if (new Date() > new Date(user.ResetPinExpires)) {
      return res.status(400).json({ success: false, message: 'Mã PIN đã hết hạn (sau 15 phút).' });
    }

    // 3. Băm mật khẩu mới (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Cập nhật mật khẩu và Xóa mã PIN dùng một lần
    const updateRequest = pool.request();
    updateRequest.input('Id', sql.Int, user.Id);
    updateRequest.input('Password', sql.NVarChar(sql.MAX), hashedPassword);

    const updateSql = `
            UPDATE dbo.Users 
            SET Password = @Password, ResetPin = NULL, ResetPinExpires = NULL
            WHERE Id = @Id
        `;
    await updateRequest.query(updateSql);

    return res.json({ success: true, message: 'Mật khẩu của bạn đã được cập nhật thành công!' });
  } catch (err) {
    console.error('Auth ResetPassword Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đặt lại mật khẩu.' });
  }
};