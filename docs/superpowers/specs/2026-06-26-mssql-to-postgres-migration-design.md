# Design: Migrate AI Engine from SQL Server to PostgreSQL (Supabase)

**Date:** 2026-06-26
**Status:** Approved (design)
**Scope:** `AI_Engine` backend database layer only

## Background & Motivation

The AI Engine (Node.js/Express) currently uses Microsoft SQL Server via the
`mssql` driver. Attempts to deploy SQL Server on Railway failed repeatedly:
non-root volume permission denial, out-of-disk on the trial volume, and finally
an instant crash consistent with SQL Server's ~2 GB RAM minimum not being met on
a trial container. SQL Server is too heavy/finicky for the target hosting.

Decision: migrate the database from SQL Server to **PostgreSQL hosted on
Supabase** (fully managed, perpetual free tier, web SQL editor — removes the
entire class of self-managed-container errors). This unblocks deployment:
Frontend → Vercel, AI Engine → Railway, DB → Supabase, vectors → Pinecone
(unchanged).

The database layer touches **~291 query call-sites across 15 files** using the
node-mssql API (`pool.request().input(name, type, value).query(text)` returning
`.recordset`). The SQL is MSSQL-specific (`TOP`, `OUTPUT INSERTED`, `GETDATE()`,
`dbo.` prefix, `@param` placeholders, `nvarchar`, bit-vs-integer comparisons).

## Goals

- Move all persistence from SQL Server to Postgres on Supabase.
- Minimize churn and regression risk across the 15 files (chosen strategy:
  compatibility shim, not a native rewrite or ORM).
- Migrate all existing data (12 tables, ~1,200 rows), preserving
  `LegalDocuments.Id` so Pinecone vectors stay aligned.
- Keep the frontend API contract unchanged (it consumes `result.recordset` rows
  with PascalCase keys directly).

## Non-Goals (YAGNI)

- No ORM (Prisma/Knex/Sequelize).
- No schema redesign or normalization changes.
- No new features.
- No frontend changes beyond the API base URL (handled in the deploy step).

## Architecture: Compatibility Shim

Rewrite **only** `src/config/db.js`. It keeps exporting `{ sql, pool, poolConnect }`
with the same surface API, backed internally by the `pg` driver. The other 14
files keep their existing `pool.request().input().query()` code.

- `pool.request()` → request object with chainable `.input(name, [type], value)`
  and `.query(text)` / `.execute()`.
- `.input(name, type, value)` → records `name → value`. The `type` argument
  (e.g. `sql.NVarChar`) is **accepted and ignored** (pg infers types).
- `.query(text)` → (1) converts `@param` → `$1,$2…` positional placeholders in
  first-seen order and builds the values array; (2) runs safe auto-translations
  (see Dialect Handling); (3) executes via `pg`; (4) returns
  `{ recordset, recordsets, rowsAffected }` shaped like node-mssql.
- `sql.NVarChar`, `sql.Int`, `sql.Bit`, `sql.MAX`, etc. → exported as harmless
  placeholder objects, also callable like `sql.NVarChar(320)`, so existing
  `.input('Email', sql.NVarChar(320), email)` calls work untouched.
- `poolConnect` → a promise resolving once the pg pool connects (preserves
  `await poolConnect`).
- `err.number` → normalized from pg's `err.code` (e.g. unique-violation
  `'23505'` → `2627`) so existing `err.number === 2627` checks keep working.

## Schema & Column-Casing Strategy

Hand-write `deploy/postgres/schema.sql` — 12 `CREATE TABLE`s translated from the
T-SQL dump. Type mapping:

| MSSQL | Postgres |
|---|---|
| `int IDENTITY(1,1)` / `bigint IDENTITY` | `int GENERATED … AS IDENTITY` / `bigint …` |
| `nvarchar(n)` / `nvarchar(max)` | `varchar(n)` / `text` |
| `datetime` / `datetime2(7)` | `timestamptz` |
| `bit` | `smallint` (NOT boolean) |
| `float` / `decimal(p,s)` | `double precision` / `numeric(p,s)` |
| `LegalDocuments.Id nvarchar(500)` (non-identity PK) | `varchar(500)` PK |

**Why `bit → smallint`:** the code compares/sets bits as integers
(`WHERE IsActive = 1`, `IsFinal = 1`). `smallint` keeps every `= 1`/`= 0` working
with zero query changes; boolean would break them.

**Casing (critical).** Postgres folds unquoted identifiers to lowercase, but the
frontend consumes `result.recordset` rows with PascalCase keys
(`Title`, `DocumentNumber`, `FullName`, …). Strategy:

1. Store **columns lowercase** in Postgres → every existing unquoted query
   (`SELECT Id, Title …`) resolves with no edits.
2. The shim **remaps each result row's keys back to canonical PascalCase** using
   a generated `lowercase → PascalCase` dictionary derived from the schema (e.g.
   `syncstatuspinecone → SyncStatusPinecone`). Rows sent to the frontend keep
   their exact original keys.
3. Each row is also wrapped in a **case-insensitive read proxy**, so code reading
   computed aliases like `countResult.recordset[0].Total` (from `COUNT(*) AS Total`,
   which pg returns as `total`) still works.

Canonical own-keys handle JSON serialization to the frontend; the case-insensitive
proxy handles backend code reads. Both the API contract and backend code keep
working unchanged.

## SQL Dialect Handling

The ~88 dialect constructs split into two buckets.

**Bucket A — auto-translated by the shim** (safe, unambiguous regex on every
query; zero manual edits):

| T-SQL | Postgres |
|---|---|
| `dbo.Table` | `Table` (strip `dbo.`) |
| `GETDATE()` / `GETUTCDATE()` | `NOW()` |
| `ISNULL(a, b)` | `COALESCE(a, b)` |
| `LEN(x)` | `LENGTH(x)` |
| `ORDER BY NEWID()` | `ORDER BY RANDOM()` |
| `@param` | `$1, $2, …` |

**Bucket B — manual per-query rewrites** (ambiguous/structural, reviewed by hand):

| T-SQL | Postgres |
|---|---|
| `SELECT TOP n …` | `SELECT … LIMIT n` |
| `INSERT … OUTPUT INSERTED.Id …` | `INSERT … RETURNING id` |
| `CHARINDEX(a, b)` | `POSITION(a IN b)` (arg order flips) |
| `a + b` (string concat) | `a \|\| b` |
| `OFFSET @o ROWS FETCH NEXT @l ROWS ONLY` | works as-is in PG (no change) |

The shim **logs every executed query** behind a `DB_DEBUG` flag. During testing,
any unconverted T-SQL surfaces as a Postgres syntax error naming the exact query,
so Bucket B items are found deterministically rather than by guesswork.

## Data Migration

One-off script `deploy/postgres/migrate-data.js`, run from the developer machine
where local SQL Server works:

1. Connect `mssql` to local `LegalBotDB` and `pg` to the Supabase connection string.
2. Create schema first (`schema.sql` against Supabase, or pasted into Supabase's
   SQL editor).
3. Copy table-by-table in FK-safe (parents-first) order:
   `Users → LegalDocuments → Lawyers → AppConfigurations → SystemSettings →
   AIFeatureUsage → AIHistory → ContractHistory → Feedbacks → VideoHistory →
   UserSavedLaws → UserRecentlyViewed`. For each: `SELECT *` from MSSQL,
   batch-`INSERT` into Postgres with explicit IDs preserved, lowercasing column
   names on the way in.
4. Reset identity sequences after each table:
   `SELECT setval(pg_get_serial_sequence('table','id'), MAX(id))` — prevents the
   duplicate-key trap on subsequent inserts.
5. Verify: print source-vs-destination row counts per table; any mismatch is a
   loud failure. (~1,200 rows total → runs in seconds.)
6. Idempotent: `TRUNCATE` each table before loading, so it is safe to re-run after
   fixing any type-mapping issue.

`bit → smallint` and `datetime → timestamptz` conversions happen in JS as rows
pass through. `LegalDocuments.Id` (string slug) is preserved exactly, keeping
Pinecone vectors in sync.

## Connection Config, Deployment & Testing

**Connection config** (shim reads from env):
- Use Supabase's **pooler** endpoint (port `6543`, transaction mode) — suits
  Railway/serverless short-lived connections and avoids exhausting direct-connection
  limits.
- New env var `DATABASE_URL` (Supabase pooler URI, `sslmode=require`); pg `Pool`
  configured with `ssl: { rejectUnauthorized: false }`.
- Remove the old `DB_SERVER/DB_USER/DB_PASSWORD/DB_PORT/DB_NAME/DB_ENCRYPT/DB_TRUST_CERT`
  vars. Update `.env.example` and `AI_Engine/.env`.

**Deployment:**
- Retire the Railway `server` (SQL Server) service and delete `deploy/mssql/`.
- AI Engine deploys to Railway from the repo (root `AI_Engine`), env points at Supabase.
- Frontend → Vercel, pointing at the AI Engine URL.

**Testing:**
1. Shim unit checks — `@param`→`$n` conversion, key-casing remap, case-insensitive
   proxy, `err.number` mapping (pure functions).
2. Local integration run — local AI Engine pointed at Supabase, exercise each route
   group (auth, documents, AI history, admin, feedback, lawyers) with `DB_DEBUG=on`;
   every Bucket-B miss surfaces as a named Postgres error.
3. Row-count verification from the migration script.
4. Deploy smoke test — register/login, list documents, run a chat (confirms
   Pinecone ↔ LegalDocuments alignment).

## Risks & Mitigations

- **Unconverted Bucket-B SQL** → `DB_DEBUG` query logging + integration pass over
  every route group surfaces each as a named error.
- **Column-casing mismatch with frontend** → schema-derived canonical-key remap +
  case-insensitive proxy; verified in the integration pass.
- **Identity collisions after import** → `setval` sequence reset per table.
- **Pinecone vector orphaning** → `LegalDocuments.Id` preserved exactly.
- **Type-mapping error on a column** → surfaces as an insert error on that table in
  the migration run; fix mapping and re-run (idempotent).

## Affected / New Files

- Rewrite: `AI_Engine/src/config/db.js` (the shim).
- Edit (Bucket-B query strings only): the 14 controller/service files as needed.
- New: `deploy/postgres/schema.sql`, `deploy/postgres/migrate-data.js`.
- Edit: `AI_Engine/.env.example`, `AI_Engine/.env`.
- Remove: `deploy/mssql/` (Dockerfile) and the Railway SQL Server service.
