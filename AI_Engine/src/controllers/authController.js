const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const googleAuthService = require('../services/googleAuthService');
const authService = require('../services/authService');
const { sql, pool, poolConnect } = require('../config/db');
const mailService = require('../services/mailService');

const JWT_SECRET = process.env.JWT_SECRET || 'DATN_DTU_2026_SECRET_KEY_999';

// Helper: kiểm tra độ mạnh mật khẩu
const validatePassword = (pwd) => {
  if (!pwd || typeof pwd !== 'string') return false;
  const re = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\?]).{6,}$/;
  return re.test(pwd);
};

/**
 * POST /auth/register
 * body: { email, password, fullName }
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ Email và mật khẩu.' });

    // Kiểm tra độ mạnh mật khẩu
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự trở lên, bao gồm ít nhất một chữ số và một ký tự đặc biệt!' });
    }

    await poolConnect;
    const checkReq = pool.request();
    checkReq.input('Email', sql.NVarChar(320), email);
    // Kiểm tra email đã tồn tại
    const existSql = `SELECT Id FROM dbo.Users WHERE Email = @Email LIMIT 1`;
    const existRes = await checkReq.query(existSql);
    if (existRes.recordset && existRes.recordset.length > 0) {
      return res.status(409).json({ success: false, message: 'Địa chỉ Email này đã được đăng ký trên hệ thống LegAI!' });
    }

    // 1. Băm mật khẩu (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);
    request.input('Password', sql.NVarChar(sql.MAX), hashedPassword);
    request.input('FullName', sql.NVarChar(200), fullName || null);
    request.input('Role', sql.NVarChar(20), 'USER');
    request.input('AuthProvider', sql.NVarChar(50), 'local');

    const insertSql = `
      INSERT INTO dbo.Users (Email, Password, FullName, Role, AuthProvider, CreatedAt, UpdatedAt)
      VALUES (@Email, @Password, @FullName, @Role, @AuthProvider, GETDATE(), GETDATE())
      RETURNING Id, Email, FullName, Role, AuthProvider
    `;

    const result = await request.query(insertSql);
    const userRow = result.recordset[0];

    // 2. Cấp JWT Token
    const token = jwt.sign(
      { id: userRow.Id, email: userRow.Email, role: userRow.Role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const user = {
      id: userRow.Id,
      email: userRow.Email,
      role: userRow.Role,
      fullName: userRow.FullName
    };

    return res.json({ success: true, user, token });
  } catch (err) {
    console.error('Auth Register Error:', err);
    if (err && err.number === 2627) {
      return res.status(409).json({ success: false, message: 'Địa chỉ Email này đã được đăng ký trên hệ thống LegAI!' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + (err.message || String(err)) });
  }
};

/**
 * POST /auth/login
 * body: { email, password }
 */
exports.login = async (req, res) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ Email và mật khẩu.' });

    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.NVarChar(320), email);

    const selectSql = `SELECT Id, Email, Password, FullName, Role, Status, AuthProvider FROM dbo.Users WHERE Email = @Email`;
    const result = await request.query(selectSql);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const userRow = result.recordset[0];

    // 0. Kiểm tra tài khoản có đang bị khóa không
    if (userRow.Status && String(userRow.Status).toLowerCase() === 'banned') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị quản trị viên khóa' });
    }

    // If this account is Google-only (AuthProvider == 'google'), do not allow password login
    if (userRow.AuthProvider && String(userRow.AuthProvider).toLowerCase() === 'google') {
      return res.status(401).json({ success: false, message: 'Tài khoản này được đăng nhập bằng Google. Vui lòng sử dụng Google Sign-In.' });
    }

    // If password is NULL/empty in DB, reject password login
    if (!userRow.Password) {
      return res.status(401).json({ success: false, message: 'Tài khoản chưa thiết lập mật khẩu. Vui lòng sử dụng Google Sign-In hoặc đặt lại mật khẩu.' });
    }

    // 1. Kiểm tra mật khẩu băm
    const isMatch = await bcrypt.compare(password, userRow.Password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
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

    return res.json({ success: true, message: 'Đăng nhập thành công.', user, token });
  } catch (err) {
    console.error('Auth Login Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + (err.message || String(err)) });
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
      return res.status(401).json({ success: false, message: 'Không có quyền truy cập.' });
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

      if (!validatePassword(newPassword)) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự trở lên, bao gồm ít nhất một chữ số và một ký tự đặc biệt!' });
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
    const rawUser = updateResult.recordset[0];
    // format lại tên trường trả về cho frontend dễ dùng hơn (camelCase)
    const updatedUser = {
      id: rawUser.Id,
      email: rawUser.Email,
      role: rawUser.Role,
      fullName: rawUser.FullName
    };

    return res.json({ success: true, message: 'Thông tin hồ sơ đã được cập nhật.', user: updatedUser });
  } catch (err) {
    console.error('Auth UpdateProfile Error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + (err.message || String(err)) });
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
      return res.status(401).json({ success: false, message: 'Không có quyền truy cập.' });
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
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + (err.message || String(err)) });
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

    // 3. Kiểm tra độ mạnh mật khẩu mới
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự trở lên, bao gồm ít nhất một chữ số và một ký tự đặc biệt!' });
    }

    // 4. Băm mật khẩu mới (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 5. Cập nhật mật khẩu và Xóa mã PIN dùng một lần
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

/**
 * POST /auth/oauth/google
 * body: { idToken }
 */
exports.googleOAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing Google ID token.' });
    }

    const payload = await googleAuthService.verifyGoogleIdToken(idToken);
    const email = payload.email;
    const googleId = payload.sub;
    const fullName = payload.name || payload.given_name || null;
    const avatar = payload.picture || null;
    const emailVerified = payload.email_verified;

    if (!email || !googleId) {
      return res.status(400).json({ success: false, message: 'Google token payload is missing required fields.' });
    }

    if (emailVerified !== undefined && emailVerified !== true) {
      return res.status(403).json({ success: false, message: 'Email address is not verified by Google.' });
    }

    let user = await authService.findUserByGoogleId(googleId);
    if (!user) {
      const existingByEmail = await authService.findUserByEmail(email);
      if (existingByEmail) {
        user = await authService.updateUserWithGoogleInfo(existingByEmail.Id, {
          googleId,
          fullName,
          avatar
        });
      } else {
        user = await authService.createUserFromGoogle({
          googleId,
          email,
          fullName,
          avatar
        });
      }
    }

    if (!user) {
      return res.status(500).json({ success: false, message: 'Unable to create or find user after Google sign-in.' });
    }

    const token = authService.generateJwtToken({
      id: user.Id,
      email: user.Email,
      role: user.Role,
      authProvider: user.AuthProvider || 'google'
    });

    const mappedUser = {
      id: user.Id,
      email: user.Email,
      role: user.Role,
      fullName: user.FullName,
      avatar: user.Avatar,
      authProvider: user.AuthProvider
    };

    return res.json({ success: true, message: 'Đăng nhập bằng Google thành công.', user: mappedUser, token });
  } catch (err) {
    console.error('Google OAuth Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi xác thực Google.' });
  }
};