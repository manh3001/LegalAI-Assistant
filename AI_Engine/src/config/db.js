// CHÚ Ý: Dùng thư viện mssql gốc (không dùng msnodesqlv8 nữa)
const sql = require('mssql');

const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_NAME || 'LegalBotDB',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 300000
    }
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
    .then(() => {
        console.log('========================================');
        console.log(' Đã  kết nối TCP/IP tới SQL Server!');
        console.log(' Tài khoản: sa | Cổng: 1433');
        console.log('========================================');
    })
    .catch(err => {
        console.error(' Lỗi kết nối DB (Cách 2):', err.message);
    });

module.exports = { sql, pool, poolConnect };