/*
 * One-off data migration: local SQL Server (LegalBotDB) -> Supabase Postgres.
 * Run from a machine where local SQL Server is reachable:
 *   DATABASE_URL=postgres://... node deploy/postgres/migrate-data.js
 *
 * Idempotent: truncates each Postgres table before loading.
 */
const fs = require('fs');
const path = require('path');
// Load AI_Engine/.env so DATABASE_URL (and optional SRC_DB_* overrides) can live
// there instead of being passed inline on the command line.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mssql = require('mssql');
const { Pool } = require('pg');

// Tables in FK-safe (parents-first) order. hasIdentity => reset its id sequence.
const TABLES = [
  { name: 'Users', pg: 'users', id: 'id', hasIdentity: true },
  { name: 'LegalDocuments', pg: 'legaldocuments', id: 'id', hasIdentity: false },
  { name: 'Lawyers', pg: 'lawyers', id: 'id', hasIdentity: true },
  { name: 'AppConfigurations', pg: 'appconfigurations', id: 'id', hasIdentity: false },
  { name: 'SystemSettings', pg: 'systemsettings', id: 'id', hasIdentity: false },
  { name: 'AIFeatureUsage', pg: 'aifeatureusage', id: 'id', hasIdentity: true },
  { name: 'AIHistory', pg: 'aihistory', id: 'id', hasIdentity: true },
  { name: 'ContractHistory', pg: 'contracthistory', id: 'id', hasIdentity: true },
  { name: 'Feedbacks', pg: 'feedbacks', id: 'id', hasIdentity: true },
  { name: 'VideoHistory', pg: 'videohistory', id: 'id', hasIdentity: true },
  { name: 'UserSavedLaws', pg: 'usersavedlaws', id: 'id', hasIdentity: true },
  { name: 'UserRecentlyViewed', pg: 'userrecentlyviewed', id: 'id', hasIdentity: true },
];

const MSSQL_CONFIG = {
  user: process.env.SRC_DB_USER || 'sa',
  password: process.env.SRC_DB_PASSWORD || '123456',
  server: process.env.SRC_DB_SERVER || 'localhost',
  port: parseInt(process.env.SRC_DB_PORT || '1433'),
  database: process.env.SRC_DB_NAME || 'LegalBotDB',
  options: { encrypt: false, trustServerCertificate: true },
};

function transformRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

async function loadSchema(pg) {
  const ddl = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pg.query(ddl);
  console.log('Schema ensured.');
}

async function copyTable(src, pg, table) {
  const result = await src.request().query(`SELECT * FROM dbo.[${table.name}]`);
  const rows = result.recordset.map(transformRow);

  await pg.query(`TRUNCATE TABLE ${table.pg} RESTART IDENTITY CASCADE`);

  for (const row of rows) {
    const cols = Object.keys(row);
    const params = cols.map((_, i) => '$' + (i + 1));
    const overriding = table.hasIdentity ? 'OVERRIDING SYSTEM VALUE ' : '';
    await pg.query(
      `INSERT INTO ${table.pg} (${cols.join(', ')}) ${overriding}VALUES (${params.join(', ')})`,
      cols.map((c) => row[c])
    );
  }

  if (table.hasIdentity) {
    await pg.query(
      `SELECT setval(pg_get_serial_sequence('${table.pg}', '${table.id}'),
              GREATEST((SELECT COALESCE(MAX(${table.id}), 0) FROM ${table.pg}), 1))`
    );
  }

  const pgCount = await pg.query(`SELECT COUNT(*)::int AS c FROM ${table.pg}`);
  const ok = pgCount.rows[0].c === rows.length;
  console.log(
    `${table.name}: source=${rows.length} dest=${pgCount.rows[0].c} ${ok ? 'OK' : 'MISMATCH!'}`
  );
  if (!ok) throw new Error(`Row count mismatch on ${table.name}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const src = await mssql.connect(MSSQL_CONFIG);
  const pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await loadSchema(pg);
    for (const table of TABLES) {
      await copyTable(src, pg, table);
    }
    console.log('\nMigration complete.');
  } finally {
    await src.close();
    await pg.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { transformRow };
