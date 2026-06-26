const { Pool } = require('pg');
const { createPool, makeSql } = require('./sqlShim');

// Supabase pooler connection. DATABASE_URL example:
//   postgresql://USER:PASS@HOST:6543/postgres?sslmode=require
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const execute = (text, values) => pgPool.query(text, values);

// node-mssql-compatible exports.
const sql = makeSql();
const pool = createPool(execute); // NOT thenable; exposes .request()

// Resolves once a connection is established (preserves `await poolConnect`).
const poolConnect = pgPool
  .connect()
  .then((client) => {
    client.release();
    console.log('========================================');
    console.log(' Connected to PostgreSQL (Supabase)!');
    console.log('========================================');
  })
  .catch((err) => {
    console.error(' Postgres connection error:', err.message);
  });

module.exports = { sql, pool, poolConnect };
