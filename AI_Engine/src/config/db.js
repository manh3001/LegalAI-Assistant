// CHÚ Ý: Dùng thư viện mssql gốc (không dùng msnodesqlv8 nữa)
const sql = require('mssql');

const dbConfig = {
    user: 'sa',
    password: '123456',
    server: 'localhost',
    port: 1433,
    database: 'LegalBotDB',
    options: {
        encrypt: false,
        trustServerCertificate: true,

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