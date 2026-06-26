const jwt = require('jsonwebtoken');
const { sql, pool, poolConnect } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'DATN_DTU_2026_SECRET_KEY_999';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

async function ensureDbReady() {
  await poolConnect;
}

function generateJwtToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function findUserByGoogleId(googleId) {
  await ensureDbReady();
  const request = pool.request();
  request.input('GoogleId', sql.NVarChar(100), googleId);
  const query = `SELECT * FROM dbo.Users WHERE GoogleId = @GoogleId LIMIT 1`;
  const result = await request.query(query);
  return result.recordset?.[0] || null;
}

async function findUserByEmail(email) {
  await ensureDbReady();
  const request = pool.request();
  request.input('Email', sql.NVarChar(320), email);
  const query = `SELECT * FROM dbo.Users WHERE Email = @Email LIMIT 1`;
  const result = await request.query(query);
  return result.recordset?.[0] || null;
}

async function createUserFromGoogle({ googleId, email, fullName, avatar }) {
  await ensureDbReady();

  const request = pool.request();
  request.input('GoogleId', sql.NVarChar(100), googleId);
  request.input('Email', sql.NVarChar(320), email);
  request.input('FullName', sql.NVarChar(200), fullName || null);
  request.input('Avatar', sql.NVarChar(1000), avatar || null);
  request.input('AuthProvider', sql.NVarChar(50), 'google');
  request.input('Role', sql.NVarChar(20), 'USER');
  request.input('Status', sql.NVarChar(50), 'Active');

  const sqlText = `
    INSERT INTO dbo.Users (GoogleId, Email, FullName, Avatar, AuthProvider, Role, Status, CreatedAt, UpdatedAt)
    VALUES (@GoogleId, @Email, @FullName, @Avatar, @AuthProvider, @Role, @Status, GETDATE(), GETDATE())
    RETURNING *
  `;

  const result = await request.query(sqlText);
  return result.recordset?.[0] || null;
}

async function updateUserWithGoogleInfo(userId, { googleId, fullName, avatar }) {
  await ensureDbReady();

  const request = pool.request();
  request.input('Id', sql.BigInt, userId);
  request.input('GoogleId', sql.NVarChar(100), googleId);
  request.input('FullName', sql.NVarChar(200), fullName || null);
  request.input('Avatar', sql.NVarChar(1000), avatar || null);
  request.input('AuthProvider', sql.NVarChar(50), 'google');

  const sqlText = `
    UPDATE dbo.Users
    SET GoogleId = @GoogleId,
        FullName = COALESCE(@FullName, FullName),
        Avatar = COALESCE(@Avatar, Avatar),
        AuthProvider = @AuthProvider,
        UpdatedAt = GETDATE()
    WHERE Id = @Id;
    SELECT * FROM dbo.Users WHERE Id = @Id LIMIT 1;
  `;

  const result = await request.query(sqlText);
  return result.recordset?.[0] || null;
}

module.exports = {
  generateJwtToken,
  findUserByGoogleId,
  findUserByEmail,
  createUserFromGoogle,
  updateUserWithGoogleInfo
};
