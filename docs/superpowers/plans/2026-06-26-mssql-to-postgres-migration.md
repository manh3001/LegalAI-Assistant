# MSSQL → Postgres (Supabase) Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the AI Engine's persistence from SQL Server to PostgreSQL on Supabase without changing the frontend API contract or rewriting the 14 controller/service files wholesale.

**Architecture:** Replace the internals of `src/config/db.js` with a compatibility shim (backed by the `pg` driver) that preserves the node-mssql surface API (`pool.request().input().query()` → `.recordset`). Pure helper modules handle `@param`→`$n` conversion, safe SQL-dialect auto-translation, result-row key re-casing, and error-code normalization. A hand-written Postgres schema and a one-off Node migration script (reads local MSSQL, writes Supabase) move the data.

**Tech Stack:** Node.js, Express, `pg` (new), `mssql` (existing, used only by the migration script), Node built-in `node:test` for tests, PostgreSQL (Supabase).

## Global Constraints

- Keep exports of `src/config/db.js` exactly `{ sql, pool, poolConnect }`.
- The exported `pool` must NOT be a thenable (no `then` property): `settingController.js` does `await pool` then `.request()`.
- `.input()` must support both `(name, value)` and `(name, type, value)`; the `type` argument is ignored.
- A request object accumulates inputs and may run `.query()` more than once (see `documentController.getAllDocuments`).
- `.query()` result shape: `{ recordset: Row[], recordsets: [Row[]], rowsAffected: number[], output: {} }`. `rowsAffected[0]` must be the affected row count.
- Result rows must serialize to JSON with canonical PascalCase/camelCase keys (frontend consumes `result.recordset` directly) AND allow case-insensitive property reads in code.
- `bit` columns map to `smallint` (0/1), never boolean — code uses `= 1`/`= 0` and assigns 1/0.
- Postgres columns are stored lowercase; identifiers are referenced unquoted in queries.
- `LegalDocuments.Id` (string slug PK) must be preserved exactly to keep Pinecone vectors aligned.
- No new runtime dependency other than `pg`. No ORM. No frontend code changes here.
- Connect via Supabase pooler URI in `DATABASE_URL` with `ssl: { rejectUnauthorized: false }`.

---

## File Structure

- `AI_Engine/src/config/sqlParams.js` — `convertNamedParams(text, valuesByName)` → `{ text, values }`
- `AI_Engine/src/config/sqlDialect.js` — `autoTranslateDialect(text)` → `string`
- `AI_Engine/src/config/sqlRows.js` — `COLUMN_NAME_MAP`, `shapeRow(row)` → proxied row
- `AI_Engine/src/config/sqlError.js` — `mapPgError(err)` → err (with `.number` set)
- `AI_Engine/src/config/sqlShim.js` — `createPool(execute)`, `makeSql()` (pure; no pg import)
- `AI_Engine/src/config/db.js` — wires a `pg` Pool to `createPool`; exports `{ sql, pool, poolConnect }`
- `AI_Engine/src/config/__tests__/*.test.js` — `node:test` unit tests
- `AI_Engine/deploy/postgres/schema.sql` — 12 `CREATE TABLE`s (lowercase columns)
- `AI_Engine/deploy/postgres/migrate-data.js` — one-off local-MSSQL → Supabase data copy
- `AI_Engine/.env.example`, `AI_Engine/.env` — `DATABASE_URL`, remove old `DB_*`

---

### Task 1: Project test harness + `pg` dependency

**Files:**
- Modify: `AI_Engine/package.json`
- Create: `AI_Engine/src/config/__tests__/smoke.test.js`

**Interfaces:**
- Produces: a working `npm test` (runs `node --test`) and `pg` available to require.

- [ ] **Step 1: Add `pg` dependency and a test script**

In `AI_Engine/package.json`, add `"pg": "^8.13.1"` to `dependencies` and add a `test` script. The `scripts` block becomes:

```json
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "node --test src/config/__tests__/",
    "db:export": "py -m mssqlscripter -S localhost -d LegalBotDB --schema-and-data -f ./data_export/full_db_sync.sql",
    "db:sync": "sqlcmd -S localhost -d LegalBotDB -E -C -i ./data_export/full_db_sync.sql"
  },
```

- [ ] **Step 2: Install**

Run: `cd AI_Engine && npm install pg`
Expected: `pg` added to `node_modules`, no errors.

- [ ] **Step 3: Write a smoke test**

Create `AI_Engine/src/config/__tests__/smoke.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');

test('pg is importable', () => {
  const pg = require('pg');
  assert.ok(pg.Pool, 'pg.Pool should exist');
});
```

- [ ] **Step 4: Run tests**

Run: `cd AI_Engine && npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/package.json AI_Engine/package-lock.json AI_Engine/src/config/__tests__/smoke.test.js
git commit -m "chore: add pg dependency and node:test harness"
```

---

### Task 2: Named-parameter converter

**Files:**
- Create: `AI_Engine/src/config/sqlParams.js`
- Test: `AI_Engine/src/config/__tests__/sqlParams.test.js`

**Interfaces:**
- Produces: `convertNamedParams(text: string, valuesByName: object) => { text: string, values: any[] }`. Replaces each `@name` token with a positional `$n`; repeated names reuse the same `$n`; ordering follows first appearance; values array is ordered to match `$1..$n`.

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/sqlParams.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { convertNamedParams } = require('../sqlParams');

test('single param', () => {
  const r = convertNamedParams('SELECT * FROM Users WHERE Email = @Email', { Email: 'a@b.c' });
  assert.strictEqual(r.text, 'SELECT * FROM Users WHERE Email = $1');
  assert.deepStrictEqual(r.values, ['a@b.c']);
});

test('repeated param reuses same placeholder', () => {
  const r = convertNamedParams(
    '(Title LIKE @s OR DocumentNumber LIKE @s)',
    { s: '%x%' }
  );
  assert.strictEqual(r.text, '(Title LIKE $1 OR DocumentNumber LIKE $1)');
  assert.deepStrictEqual(r.values, ['%x%']);
});

test('prefix-name safety: @user vs @userId', () => {
  const r = convertNamedParams('@userId = @user', { userId: 1, user: 2 });
  assert.strictEqual(r.text, '$1 = $2');
  assert.deepStrictEqual(r.values, [1, 2]);
});

test('order follows first appearance', () => {
  const r = convertNamedParams('@b @a @b', { a: 'A', b: 'B' });
  assert.strictEqual(r.text, '$1 $2 $1');
  assert.deepStrictEqual(r.values, ['B', 'A']);
});

test('no params', () => {
  const r = convertNamedParams('SELECT 1', {});
  assert.strictEqual(r.text, 'SELECT 1');
  assert.deepStrictEqual(r.values, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlParams.test.js`
Expected: FAIL ("Cannot find module '../sqlParams'").

- [ ] **Step 3: Write minimal implementation**

Create `AI_Engine/src/config/sqlParams.js`:

```js
// Converts node-mssql style @named params into pg positional $1..$n.
// Repeated @name reuses the same placeholder. Full-token (\w+) match makes
// prefix names (@user vs @userId) safe in a single pass.
function convertNamedParams(text, valuesByName) {
  const indexByName = new Map();
  const order = [];
  const pgText = text.replace(/@(\w+)/g, (_match, name) => {
    if (!indexByName.has(name)) {
      order.push(name);
      indexByName.set(name, order.length); // 1-based
    }
    return '$' + indexByName.get(name);
  });
  const values = order.map((name) => valuesByName[name]);
  return { text: pgText, values };
}

module.exports = { convertNamedParams };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlParams.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/src/config/sqlParams.js AI_Engine/src/config/__tests__/sqlParams.test.js
git commit -m "feat: add @param to \$n converter for pg shim"
```

---

### Task 3: SQL dialect auto-translator

**Files:**
- Create: `AI_Engine/src/config/sqlDialect.js`
- Test: `AI_Engine/src/config/__tests__/sqlDialect.test.js`

**Interfaces:**
- Produces: `autoTranslateDialect(text: string) => string`. Applies only the safe, unambiguous T-SQL→Postgres substitutions (Bucket A). Does NOT touch `TOP` or `OUTPUT INSERTED` (handled manually in Tasks 8–9).

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/sqlDialect.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { autoTranslateDialect } = require('../sqlDialect');

test('strips dbo. prefix', () => {
  assert.strictEqual(autoTranslateDialect('SELECT * FROM dbo.Users'), 'SELECT * FROM Users');
});

test('GETDATE and GETUTCDATE', () => {
  assert.strictEqual(autoTranslateDialect('VALUES (GETDATE())'), 'VALUES (NOW())');
  assert.strictEqual(
    autoTranslateDialect('VALUES (GETUTCDATE())'),
    "VALUES ((NOW() AT TIME ZONE 'utc'))"
  );
});

test('ISNULL -> COALESCE and LEN -> LENGTH', () => {
  assert.strictEqual(autoTranslateDialect('ISNULL(a, b)'), 'COALESCE(a, b)');
  assert.strictEqual(autoTranslateDialect('LEN(x)'), 'LENGTH(x)');
});

test('ORDER BY NEWID() -> ORDER BY RANDOM()', () => {
  assert.strictEqual(
    autoTranslateDialect('ORDER BY NEWID()'),
    'ORDER BY RANDOM()'
  );
});

test('case-insensitive and does not mangle GETUTCDATE into GETDATE', () => {
  assert.strictEqual(autoTranslateDialect('getdate()'), 'NOW()');
  assert.ok(!autoTranslateDialect('GETUTCDATE()').includes('UTCNOW'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlDialect.test.js`
Expected: FAIL ("Cannot find module '../sqlDialect'").

- [ ] **Step 3: Write minimal implementation**

Create `AI_Engine/src/config/sqlDialect.js`:

```js
// Safe, unambiguous T-SQL -> Postgres substitutions (Bucket A).
// GETUTCDATE is handled before GETDATE for clarity; the \b anchors already
// keep them distinct.
function autoTranslateDialect(text) {
  return text
    .replace(/\bdbo\./gi, '')
    .replace(/\bGETUTCDATE\s*\(\s*\)/gi, "(NOW() AT TIME ZONE 'utc')")
    .replace(/\bGETDATE\s*\(\s*\)/gi, 'NOW()')
    .replace(/\bISNULL\s*\(/gi, 'COALESCE(')
    .replace(/\bLEN\s*\(/gi, 'LENGTH(')
    .replace(/ORDER\s+BY\s+NEWID\s*\(\s*\)/gi, 'ORDER BY RANDOM()');
}

module.exports = { autoTranslateDialect };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlDialect.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/src/config/sqlDialect.js AI_Engine/src/config/__tests__/sqlDialect.test.js
git commit -m "feat: add safe T-SQL dialect auto-translation"
```

---

### Task 4: Column-name map + result-row shaping

**Files:**
- Create: `AI_Engine/src/config/sqlRows.js`
- Test: `AI_Engine/src/config/__tests__/sqlRows.test.js`

**Interfaces:**
- Produces: `COLUMN_NAME_MAP` (lowercase → canonical name) and `shapeRow(row: object) => object`. `shapeRow` returns an object whose own keys are canonical (so JSON serialization is correct) wrapped in a Proxy that also resolves property reads case-insensitively (so computed aliases like `total` are readable as `.Total`).

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/sqlRows.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { shapeRow, COLUMN_NAME_MAP } = require('../sqlRows');

test('remaps known columns to canonical case', () => {
  const r = shapeRow({ id: 5, syncstatuspinecone: 'success', fullname: 'Ann' });
  assert.strictEqual(r.Id, 5);
  assert.strictEqual(r.SyncStatusPinecone, 'success');
  assert.strictEqual(r.FullName, 'Ann');
});

test('JSON.stringify emits canonical keys', () => {
  const r = shapeRow({ id: 1, email: 'a@b.c' });
  assert.strictEqual(JSON.stringify(r), '{"Id":1,"Email":"a@b.c"}');
});

test('camelCase config columns keep their canonical case', () => {
  const r = shapeRow({ geminiapikey: 'k', appname: 'LegAI' });
  assert.strictEqual(r.geminiApiKey, 'k');
  assert.strictEqual(r.appName, 'LegAI');
});

test('unknown computed alias is readable case-insensitively', () => {
  const r = shapeRow({ total: 42 });
  assert.strictEqual(r.Total, 42); // proxy fallback
  assert.strictEqual(r.total, 42);
});

test('map is non-empty and includes a sample entry', () => {
  assert.ok(Object.keys(COLUMN_NAME_MAP).length > 50);
  assert.strictEqual(COLUMN_NAME_MAP['syncstatuspinecone'], 'SyncStatusPinecone');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlRows.test.js`
Expected: FAIL ("Cannot find module '../sqlRows'").

- [ ] **Step 3: Write minimal implementation**

Create `AI_Engine/src/config/sqlRows.js`:

```js
// lowercase -> canonical column name, derived from deploy/postgres/schema.sql.
// Conflicting names (id/createdat/updatedat) resolve to the PascalCase form
// used by 11 of 12 tables; AppConfigurations never reads those columns off the
// row, so this is safe.
const COLUMN_NAME_MAP = {
  id: 'Id',
  userid: 'UserId',
  featurename: 'FeatureName',
  usagecount: 'UsageCount',
  lastused: 'LastUsed',
  createdat: 'CreatedAt',
  querytext: 'QueryText',
  responsetext: 'ResponseText',
  operationtype: 'OperationType',
  appname: 'appName',
  adminemail: 'adminEmail',
  geminiapikey: 'geminiApiKey',
  geminimodel: 'geminiModel',
  temperature: 'temperature',
  pineconeapikey: 'pineconeApiKey',
  pineconeindex: 'pineconeIndex',
  updatedat: 'UpdatedAt',
  filename: 'FileName',
  originalfilename: 'OriginalFileName',
  filepath: 'FilePath',
  uploadedat: 'UploadedAt',
  analysisat: 'AnalysisAt',
  riskscore: 'RiskScore',
  confidence: 'Confidence',
  analysisjson: 'AnalysisJson',
  analysistext: 'AnalysisText',
  aimodel: 'AIModel',
  durationms: 'DurationMs',
  isfinal: 'IsFinal',
  recordtype: 'RecordType',
  title: 'Title',
  folder: 'Folder',
  status: 'Status',
  deletedat: 'DeletedAt',
  contracttext: 'ContractText',
  description: 'Description',
  name: 'Name',
  email: 'Email',
  type: 'Type',
  rating: 'Rating',
  content: 'Content',
  replycontent: 'ReplyContent',
  fullname: 'FullName',
  phone: 'Phone',
  specialty: 'Specialty',
  isactive: 'IsActive',
  documentnumber: 'DocumentNumber',
  issueyear: 'IssueYear',
  category: 'Category',
  sourceurl: 'SourceUrl',
  syncstatusssms: 'SyncStatusSsms',
  syncstatuspinecone: 'SyncStatusPinecone',
  agency: 'Agency',
  issuedatestring: 'IssueDateString',
  isautocrawlon: 'IsAutoCrawlOn',
  crawltime: 'CrawlTime',
  targeturls: 'TargetUrls',
  dailylimit: 'DailyLimit',
  filterpatterns: 'FilterPatterns',
  documentid: 'DocumentId',
  documenttitle: 'DocumentTitle',
  viewedat: 'ViewedAt',
  password: 'Password',
  role: 'Role',
  resetpin: 'ResetPin',
  resetpinexpires: 'ResetPinExpires',
  googleid: 'GoogleId',
  avatar: 'Avatar',
  authprovider: 'AuthProvider',
  savedat: 'SavedAt',
  videourl: 'VideoUrl',
  platform: 'Platform',
  transcript: 'Transcript',
  summary: 'Summary',
  legalbases: 'LegalBases',
  trustscore: 'TrustScore',
  lastaccessedat: 'LastAccessedAt',
  accesscount: 'AccessCount',
};

function shapeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[COLUMN_NAME_MAP[key] || key] = value;
  }
  return new Proxy(out, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        const lower = prop.toLowerCase();
        for (const key of Object.keys(target)) {
          if (key.toLowerCase() === lower) return target[key];
        }
      }
      return target[prop];
    },
  });
}

module.exports = { COLUMN_NAME_MAP, shapeRow };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlRows.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/src/config/sqlRows.js AI_Engine/src/config/__tests__/sqlRows.test.js
git commit -m "feat: add result-row key re-casing for pg shim"
```

---

### Task 5: Postgres error-code normalizer

**Files:**
- Create: `AI_Engine/src/config/sqlError.js`
- Test: `AI_Engine/src/config/__tests__/sqlError.test.js`

**Interfaces:**
- Produces: `mapPgError(err) => err`. Sets `err.number` from `err.code` so existing `err.number === 2627` (unique-violation) checks keep working. Maps pg `'23505'` → `2627`. Returns the same error object.

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/sqlError.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { mapPgError } = require('../sqlError');

test('maps unique violation 23505 to mssql 2627', () => {
  const e = Object.assign(new Error('dup'), { code: '23505' });
  const mapped = mapPgError(e);
  assert.strictEqual(mapped.number, 2627);
  assert.strictEqual(mapped, e);
});

test('leaves number undefined for unmapped codes', () => {
  const e = Object.assign(new Error('other'), { code: '42P01' });
  assert.strictEqual(mapPgError(e).number, undefined);
});

test('handles errors with no code', () => {
  const e = new Error('plain');
  assert.strictEqual(mapPgError(e).number, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlError.test.js`
Expected: FAIL ("Cannot find module '../sqlError'").

- [ ] **Step 3: Write minimal implementation**

Create `AI_Engine/src/config/sqlError.js`:

```js
// Map pg SQLSTATE codes onto the mssql error "number" values the code checks.
const PG_TO_MSSQL = {
  '23505': 2627, // unique_violation -> mssql duplicate key
};

function mapPgError(err) {
  if (err && err.code && PG_TO_MSSQL[err.code] !== undefined) {
    err.number = PG_TO_MSSQL[err.code];
  }
  return err;
}

module.exports = { mapPgError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlError.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/src/config/sqlError.js AI_Engine/src/config/__tests__/sqlError.test.js
git commit -m "feat: normalize pg error codes to mssql numbers"
```

---

### Task 6: Assemble the shim (`sqlShim.js`)

**Files:**
- Create: `AI_Engine/src/config/sqlShim.js`
- Test: `AI_Engine/src/config/__tests__/sqlShim.test.js`

**Interfaces:**
- Consumes: `convertNamedParams` (Task 2), `autoTranslateDialect` (Task 3), `shapeRow` (Task 4), `mapPgError` (Task 5).
- Produces:
  - `createPool(execute)` → `{ request() }` where `execute(text, values)` returns a promise of `{ rows: object[], rowCount: number }` (the `pg` query result shape). `request()` returns `{ input(name, [type], value), query(text), execute(text) }`. `query` resolves `{ recordset, recordsets, rowsAffected, output }`.
  - `makeSql()` → an object where any property access returns a self-returning callable (so `sql.NVarChar`, `sql.NVarChar(320)`, `sql.Decimal(3,2)`, `sql.Int`, `sql.MAX` all work and are ignored).

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/sqlShim.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { createPool, makeSql } = require('../sqlShim');

function stub(captured, rows = [], rowCount = 0) {
  return async (text, values) => {
    captured.text = text;
    captured.values = values;
    return { rows, rowCount };
  };
}

test('input (3-arg) + query: translates dialect and params, shapes recordset', async () => {
  const cap = {};
  const pool = createPool(stub(cap, [{ id: 1, email: 'a@b.c' }], 1));
  const result = await pool
    .request()
    .input('Email', { type: 'ignored' }, 'a@b.c')
    .query('SELECT Id, Email FROM dbo.Users WHERE Email = @Email');

  assert.strictEqual(cap.text, 'SELECT Id, Email FROM Users WHERE Email = $1');
  assert.deepStrictEqual(cap.values, ['a@b.c']);
  assert.strictEqual(result.recordset[0].Id, 1);
  assert.deepStrictEqual(result.rowsAffected, [1]);
  assert.strictEqual(JSON.stringify(result.recordset[0]), '{"Id":1,"Email":"a@b.c"}');
});

test('input (2-arg) form works', async () => {
  const cap = {};
  const pool = createPool(stub(cap, [], 0));
  await pool.request().input('id', 7).query('DELETE FROM dbo.Users WHERE Id = @id');
  assert.strictEqual(cap.text, 'DELETE FROM Users WHERE Id = $1');
  assert.deepStrictEqual(cap.values, [7]);
});

test('request can run query twice retaining inputs', async () => {
  const cap = {};
  const pool = createPool(stub(cap, [], 0));
  const req = pool.request().input('c', 'law');
  await req.query('SELECT 1 FROM Docs WHERE Category = @c');
  await req.query('SELECT 2 FROM Docs WHERE Category = @c');
  assert.deepStrictEqual(cap.values, ['law']);
});

test('query maps pg errors to mssql numbers', async () => {
  const pool = createPool(async () => {
    throw Object.assign(new Error('dup'), { code: '23505' });
  });
  await assert.rejects(
    () => pool.request().query('INSERT INTO Users DEFAULT VALUES'),
    (err) => err.number === 2627
  );
});

test('makeSql returns ignorable callable type markers', () => {
  const sql = makeSql();
  assert.doesNotThrow(() => sql.NVarChar);
  assert.doesNotThrow(() => sql.NVarChar(320));
  assert.doesNotThrow(() => sql.Decimal(3, 2));
  assert.doesNotThrow(() => sql.Int);
  assert.doesNotThrow(() => sql.MAX);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlShim.test.js`
Expected: FAIL ("Cannot find module '../sqlShim'").

- [ ] **Step 3: Write minimal implementation**

Create `AI_Engine/src/config/sqlShim.js`:

```js
const { convertNamedParams } = require('./sqlParams');
const { autoTranslateDialect } = require('./sqlDialect');
const { shapeRow } = require('./sqlRows');
const { mapPgError } = require('./sqlError');

const DEBUG = process.env.DB_DEBUG === '1' || process.env.DB_DEBUG === 'true';

// `execute(text, values)` must return a promise of { rows, rowCount } (pg shape).
function createRequest(execute) {
  const inputs = {};
  const request = {
    input(name, typeOrValue, maybeValue) {
      inputs[name] = arguments.length >= 3 ? maybeValue : typeOrValue;
      return request;
    },
    async query(text) {
      const translated = autoTranslateDialect(text);
      const { text: pgText, values } = convertNamedParams(translated, inputs);
      if (DEBUG) console.log('[DB]', pgText, JSON.stringify(values));
      try {
        const res = await execute(pgText, values);
        const recordset = (res.rows || []).map(shapeRow);
        return {
          recordset,
          recordsets: [recordset],
          rowsAffected: [res.rowCount || 0],
          output: {},
        };
      } catch (err) {
        throw mapPgError(err);
      }
    },
    // No stored procedures are used in this codebase; execute() aliases query().
    execute(text) {
      return request.query(text);
    },
  };
  return request;
}

function createPool(execute) {
  return { request: () => createRequest(execute) };
}

// Self-returning callable so sql.X and sql.X(args) both work and are ignored.
function makeSql() {
  const marker = function () {
    return marker;
  };
  return new Proxy(
    {},
    {
      get() {
        return marker;
      },
    }
  );
}

module.exports = { createPool, makeSql };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/sqlShim.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/src/config/sqlShim.js AI_Engine/src/config/__tests__/sqlShim.test.js
git commit -m "feat: assemble node-mssql compatibility shim over pg"
```

---

### Task 7: Postgres schema

**Files:**
- Create: `AI_Engine/deploy/postgres/schema.sql`
- Test: `AI_Engine/src/config/__tests__/schemaConsistency.test.js`

**Interfaces:**
- Consumes: `COLUMN_NAME_MAP` (Task 4).
- Produces: `schema.sql` with 12 lowercase-column tables. The consistency test asserts every non-`id`/`createdat`/`updatedat` column declared in `schema.sql` has an entry in `COLUMN_NAME_MAP`.

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/schemaConsistency.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { COLUMN_NAME_MAP } = require('../sqlRows');

test('every schema column is covered by COLUMN_NAME_MAP', () => {
  const sqlText = fs.readFileSync(
    path.join(__dirname, '../../../deploy/postgres/schema.sql'),
    'utf8'
  );
  // Grab "  <name> <type>" column lines inside CREATE TABLE blocks.
  const colNames = new Set();
  for (const line of sqlText.split('\n')) {
    const m = line.match(/^\s+([a-z_]+)\s+(varchar|text|int|bigint|smallint|timestamptz|double|numeric)/i);
    if (m) colNames.add(m[1].toLowerCase());
  }
  assert.ok(colNames.size >= 70, `expected >=70 columns, got ${colNames.size}`);
  const missing = [...colNames].filter((c) => !(c in COLUMN_NAME_MAP));
  assert.deepStrictEqual(missing, [], `columns missing from map: ${missing}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/schemaConsistency.test.js`
Expected: FAIL (file not found, or column set empty).

- [ ] **Step 3: Write the schema**

Create `AI_Engine/deploy/postgres/schema.sql`:

```sql
-- LegAI Postgres schema (translated from SQL Server LegalBotDB).
-- Columns are lowercase; the app shim re-cases result keys.
-- bit -> smallint (code uses = 1 / = 0). nvarchar -> varchar/text.
-- datetime/datetime2 -> timestamptz.

CREATE TABLE aifeatureusage (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid      bigint,
  featurename varchar(100) NOT NULL,
  usagecount  int NOT NULL,
  lastused    timestamptz NOT NULL,
  createdat   timestamptz NOT NULL
);

CREATE TABLE aihistory (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid        bigint,
  querytext     text NOT NULL,
  responsetext  text,
  operationtype varchar(100),
  createdat     timestamptz NOT NULL
);

CREATE TABLE appconfigurations (
  id            int PRIMARY KEY,
  appname       varchar(255) NOT NULL,
  adminemail    varchar(255) NOT NULL,
  geminiapikey  varchar(500) NOT NULL,
  geminimodel   varchar(100) NOT NULL,
  temperature   numeric(3,2) NOT NULL,
  pineconeapikey varchar(500) NOT NULL,
  pineconeindex varchar(255) NOT NULL,
  createdat     timestamptz,
  updatedat     timestamptz
);

CREATE TABLE contracthistory (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid           bigint NOT NULL,
  filename         text,
  originalfilename varchar(260),
  filepath         text,
  uploadedat       timestamptz NOT NULL,
  analysisat       timestamptz,
  riskscore        int,
  confidence       double precision,
  analysisjson     text,
  analysistext     text,
  aimodel          varchar(200),
  durationms       int,
  isfinal          smallint NOT NULL,
  createdat        timestamptz NOT NULL,
  updatedat        timestamptz,
  recordtype       varchar(50),
  title            varchar(500),
  folder           varchar(200),
  status           varchar(50),
  deletedat        timestamptz,
  contracttext     text,
  description      text
);

CREATE TABLE feedbacks (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid       int,
  name         varchar(200) NOT NULL,
  email        varchar(320) NOT NULL,
  type         varchar(50) NOT NULL,
  rating       int NOT NULL,
  content      text NOT NULL,
  status       varchar(50),
  replycontent text,
  createdat    timestamptz
);

CREATE TABLE lawyers (
  id        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fullname  varchar(100) NOT NULL,
  phone     varchar(20) NOT NULL,
  specialty varchar(200),
  isactive  smallint,
  createdat timestamptz
);

CREATE TABLE legaldocuments (
  id                 varchar(500) PRIMARY KEY,
  title              varchar(500) NOT NULL,
  documentnumber     varchar(100),
  issueyear          int,
  status             varchar(50),
  category           varchar(100),
  content            text,
  createdat          timestamptz,
  sourceurl          varchar(500),
  syncstatusssms     varchar(50),
  syncstatuspinecone varchar(50),
  agency             varchar(500),
  issuedatestring    varchar(500)
);

CREATE TABLE systemsettings (
  id             int PRIMARY KEY,
  isautocrawlon  smallint NOT NULL,
  crawltime      varchar(5) NOT NULL,
  targeturls     text,
  dailylimit     int NOT NULL,
  filterpatterns text,
  updatedat      timestamptz
);

CREATE TABLE userrecentlyviewed (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  text NOT NULL,
  documentnumber varchar(50) NOT NULL,
  issueyear      int,
  viewedat       timestamptz NOT NULL
);

CREATE TABLE users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email           varchar(320) NOT NULL,
  password        text,
  fullname        varchar(200),
  role            varchar(20) NOT NULL,
  createdat       timestamptz NOT NULL,
  updatedat       timestamptz,
  resetpin        varchar(10),
  resetpinexpires timestamptz,
  status          varchar(20) NOT NULL,
  googleid        varchar(100),
  avatar          varchar(1000),
  authprovider    varchar(50)
);

CREATE TABLE usersavedlaws (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  varchar(500) NOT NULL,
  documentnumber varchar(100),
  issueyear      int,
  savedat        timestamptz NOT NULL
);

CREATE TABLE videohistory (
  id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  videourl       varchar(500) NOT NULL,
  platform       varchar(50),
  title          varchar(500),
  transcript     text,
  summary        text,
  legalbases     text,
  trustscore     int,
  aimodel        varchar(100),
  createdat      timestamptz,
  status         varchar(50),
  lastaccessedat timestamptz,
  accesscount    int,
  analysisjson   text
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/schemaConsistency.test.js`
Expected: PASS (1 test). If a column is reported missing, add it to `COLUMN_NAME_MAP` in `sqlRows.js`.

- [ ] **Step 5: Commit**

```bash
git add AI_Engine/deploy/postgres/schema.sql AI_Engine/src/config/__tests__/schemaConsistency.test.js
git commit -m "feat: add Postgres schema and schema/map consistency test"
```

---

### Task 8: Manual rewrite — `OUTPUT INSERTED` → `RETURNING`

**Files:**
- Modify: `AI_Engine/src/services/authService.js:47`
- Modify: `AI_Engine/src/controllers/authController.js:54`
- Modify: `AI_Engine/src/controllers/historyController.js:30`
- Modify: `AI_Engine/src/controllers/historyController.js:264`
- Modify: `AI_Engine/src/services/legalDataService.js:178`

**Interfaces:**
- Consumes: nothing new. These are query-string edits; the shim handles the rest.
- Produces: inserts that return their generated row via Postgres `RETURNING`. Note Postgres `RETURNING` columns come back lowercase and are re-cased by `shapeRow`, so existing `.recordset[0].Id` reads keep working.

- [ ] **Step 1: Rewrite `authService.js` (the `*` form)**

In `AI_Engine/src/services/authService.js`, the INSERT uses `OUTPUT INSERTED.*` between the column list and `VALUES`. Move it to a trailing `RETURNING *`. Change:

```
    OUTPUT INSERTED.*
```
Remove that line, and append `RETURNING *` as the last line of the INSERT statement (after the `VALUES (...)` clause). For example, an insert shaped like:

```sql
INSERT INTO dbo.Users (Email, Password, ...)
OUTPUT INSERTED.*
VALUES (@Email, @Password, ...)
```
becomes:
```sql
INSERT INTO dbo.Users (Email, Password, ...)
VALUES (@Email, @Password, ...)
RETURNING *
```

- [ ] **Step 2: Rewrite `authController.js:54`**

Change the OUTPUT clause:
```sql
      OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FullName, INSERTED.Role, INSERTED.AuthProvider
```
Remove it from between the columns and `VALUES`, and append after the `VALUES (...)` line:
```sql
      RETURNING Id, Email, FullName, Role, AuthProvider
```

- [ ] **Step 3: Rewrite `historyController.js:30`**

Move:
```sql
      OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.Title, INSERTED.RecordType, INSERTED.RiskScore, INSERTED.AnalysisAt
```
to a trailing:
```sql
      RETURNING Id, UserId, Title, RecordType, RiskScore, AnalysisAt
```

- [ ] **Step 4: Rewrite `historyController.js:264`**

Move:
```sql
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.RecordType, INSERTED.CreatedAt
```
to a trailing:
```sql
      RETURNING Id, Title, RecordType, CreatedAt
```

- [ ] **Step 5: Rewrite `legalDataService.js:178`**

Move the `OUTPUT INSERTED.Id` clause to a trailing `RETURNING Id` after the statement's `VALUES (...)`.

- [ ] **Step 6: Sanity check no OUTPUT remains**

Run: `cd AI_Engine && grep -rn "OUTPUT INSERTED" src/`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add AI_Engine/src/services/authService.js AI_Engine/src/controllers/authController.js AI_Engine/src/controllers/historyController.js AI_Engine/src/services/legalDataService.js
git commit -m "refactor: convert OUTPUT INSERTED to Postgres RETURNING"
```

---

### Task 9: Manual rewrite — `TOP n` → `LIMIT n`

**Files:**
- Modify: `AI_Engine/src/controllers/adminController.js` (lines 85, 225, 486, 602)
- Modify: `AI_Engine/src/controllers/lawyerController.js:29`
- Modify: `AI_Engine/src/services/authService.js` (lines 19, 28, 73)
- Modify: `AI_Engine/src/controllers/authController.js:35`
- Modify: `AI_Engine/src/controllers/aiController.js` (lines 499, 582, 621)
- Modify: `AI_Engine/src/controllers/historyController.js` (lines 213, 408)

**Interfaces:**
- Produces: each `SELECT TOP n …` / `SELECT TOP (n) …` becomes `SELECT … LIMIT n`, with `LIMIT n` placed at the very end of the statement (after any `ORDER BY`). Remove the `TOP n` / `TOP (n)` token from immediately after `SELECT`.

- [ ] **Step 1: Rewrite each occurrence**

Apply this transformation to every listed line. Remove `TOP n` or `TOP (n)` after `SELECT`, and append `LIMIT n` at the end of that statement (after `ORDER BY …` if present, before any trailing `;`). Exact before → after:

- `adminController.js:85`
  `SELECT TOP 1 * FROM dbo.SystemSettings ORDER BY UpdatedAt DESC`
  → `SELECT * FROM dbo.SystemSettings ORDER BY UpdatedAt DESC LIMIT 1`
- `adminController.js:225` `SELECT TOP (10) Id, Title, …` → drop `TOP (10)`; append `LIMIT 10` after this statement's `ORDER BY` clause.
- `adminController.js:486` `SELECT TOP (10)` → drop `TOP (10)`; append `LIMIT 10` after this statement's `ORDER BY` clause.
- `adminController.js:602`
  `SELECT TOP 1 FullName, Phone, Specialty FROM Lawyers WHERE IsActive = 1 ORDER BY NEWID()`
  → `SELECT FullName, Phone, Specialty FROM Lawyers WHERE IsActive = 1 ORDER BY NEWID() LIMIT 1`
  (`ORDER BY NEWID()` is auto-translated to `ORDER BY RANDOM()` by the shim.)
- `lawyerController.js:29` `SELECT TOP 1 Id, FullName, Phone, Specialty … ORDER BY NEWID()` → drop `TOP 1`; append `LIMIT 1` at end.
- `authService.js:19` `SELECT TOP 1 * FROM dbo.Users WHERE GoogleId = @GoogleId` → `SELECT * FROM dbo.Users WHERE GoogleId = @GoogleId LIMIT 1`
- `authService.js:28` `SELECT TOP 1 * FROM dbo.Users WHERE Email = @Email` → `SELECT * FROM dbo.Users WHERE Email = @Email LIMIT 1`
- `authService.js:73` `SELECT TOP 1 * FROM dbo.Users WHERE Id = @Id;` → `SELECT * FROM dbo.Users WHERE Id = @Id LIMIT 1;`
- `authController.js:35` `SELECT TOP 1 Id FROM dbo.Users WHERE Email = @Email` → `SELECT Id FROM dbo.Users WHERE Email = @Email LIMIT 1`
- `aiController.js:499` `SELECT TOP 1 * FROM VideoHistory WHERE VideoUrl = @Url` → `SELECT * FROM VideoHistory WHERE VideoUrl = @Url LIMIT 1`
- `aiController.js:582` `SELECT TOP (500) Id` → drop `TOP (500)`; append `LIMIT 500` at the end of that statement.
- `aiController.js:621` `SELECT TOP 1 * FROM VideoHistory WHERE VideoUrl = @Url` → `SELECT * FROM VideoHistory WHERE VideoUrl = @Url LIMIT 1`
- `historyController.js:213` `SELECT TOP 1 Id FROM dbo.ContractHistory …` → drop `TOP 1`; append `LIMIT 1` after this statement's final clause.
- `historyController.js:408` `SELECT TOP 8 …` → drop `TOP 8`; append `LIMIT 8` after this statement's `ORDER BY`/final clause.

For each, read the surrounding statement to find where `ORDER BY` / the statement ends, and place `LIMIT n` there.

- [ ] **Step 2: Sanity check no TOP remains**

Run: `cd AI_Engine && grep -rniE "\bTOP\s*\(?\s*[0-9]" src/`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add AI_Engine/src/controllers/adminController.js AI_Engine/src/controllers/lawyerController.js AI_Engine/src/services/authService.js AI_Engine/src/controllers/authController.js AI_Engine/src/controllers/aiController.js AI_Engine/src/controllers/historyController.js
git commit -m "refactor: convert SELECT TOP n to Postgres LIMIT n"
```

---

### Task 10: Wire `db.js` to pg + Supabase, update env

**Files:**
- Rewrite: `AI_Engine/src/config/db.js`
- Modify: `AI_Engine/.env.example`
- Modify: `AI_Engine/.env`

**Interfaces:**
- Consumes: `createPool`, `makeSql` (Task 6).
- Produces: `module.exports = { sql, pool, poolConnect }`. `pool` is the shim object (has `.request()`, not thenable). `poolConnect` is a promise resolving once the pg pool connects. `sql` is the ignorable type-marker object.

- [ ] **Step 1: Rewrite `db.js`**

Replace the entire contents of `AI_Engine/src/config/db.js` with:

```js
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
```

- [ ] **Step 2: Update `.env.example`**

In `AI_Engine/.env.example`, remove the `DB_SERVER/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_ENCRYPT/DB_TRUST_CERT` block and replace with:

```
# Database (PostgreSQL / Supabase pooler)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?sslmode=require
```

- [ ] **Step 3: Update `.env` with your real Supabase pooler URL**

In `AI_Engine/.env`, add the real `DATABASE_URL` (from Supabase → Project Settings → Database → Connection string → "Transaction" pooler, port 6543). Remove the old `DB_*` lines.

- [ ] **Step 4: Verify the app boots and connects**

Run: `cd AI_Engine && node -e "require('./src/config/db').poolConnect.then(()=>{console.log('OK');process.exit(0)})"`
Expected: prints the "Connected to PostgreSQL (Supabase)!" banner then `OK`. (Requires the Supabase schema to exist — if you haven't loaded it yet, do Task 11 Step 3 first, or expect only the connection banner.)

- [ ] **Step 5: Run the full unit suite**

Run: `cd AI_Engine && npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add AI_Engine/src/config/db.js AI_Engine/.env.example
git commit -m "feat: connect db.js shim to pg/Supabase, drop mssql config"
```

(Do NOT commit `.env` — it is gitignored.)

---

### Task 11: Data migration script

**Files:**
- Create: `AI_Engine/deploy/postgres/migrate-data.js`
- Test: `AI_Engine/src/config/__tests__/migrateTransform.test.js`

**Interfaces:**
- Consumes: `mssql` (existing dep), `pg` (Task 1), local `LegalBotDB`, Supabase `DATABASE_URL`.
- Produces: `transformRow(row)` (exported pure helper) that lowercases keys and converts booleans to 0/1; and a runnable script that creates the schema, copies all 12 tables parents-first, resets identity sequences, and verifies row counts.

- [ ] **Step 1: Write the failing test**

Create `AI_Engine/src/config/__tests__/migrateTransform.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { transformRow } = require('../../../deploy/postgres/migrate-data');

test('lowercases keys', () => {
  assert.deepStrictEqual(transformRow({ Id: 1, FullName: 'A' }), { id: 1, fullname: 'A' });
});

test('booleans (bit) become 0/1', () => {
  assert.deepStrictEqual(transformRow({ IsActive: true, IsFinal: false }), { isactive: 1, isfinal: 0 });
});

test('leaves dates and nulls as-is', () => {
  const d = new Date('2026-01-01T00:00:00Z');
  const out = transformRow({ CreatedAt: d, Note: null });
  assert.strictEqual(out.createdat, d);
  assert.strictEqual(out.note, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd AI_Engine && node --test src/config/__tests__/migrateTransform.test.js`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write the migration script**

Create `AI_Engine/deploy/postgres/migrate-data.js`:

```js
/*
 * One-off data migration: local SQL Server (LegalBotDB) -> Supabase Postgres.
 * Run from a machine where local SQL Server is reachable:
 *   DATABASE_URL=postgres://... node deploy/postgres/migrate-data.js
 *
 * Idempotent: truncates each Postgres table before loading.
 */
const fs = require('fs');
const path = require('path');
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd AI_Engine && node --test src/config/__tests__/migrateTransform.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the live migration**

Ensure local SQL Server is running and `DATABASE_URL` points at Supabase. Run:
`cd AI_Engine && node deploy/postgres/migrate-data.js`
Expected: per-table `source=… dest=… OK` lines for all 12 tables, then `Migration complete.` Any `MISMATCH!` aborts — fix the offending column's type in `schema.sql` and re-run (idempotent).

- [ ] **Step 6: Commit**

```bash
git add AI_Engine/deploy/postgres/migrate-data.js AI_Engine/src/config/__tests__/migrateTransform.test.js
git commit -m "feat: add local-MSSQL to Supabase data migration script"
```

---

### Task 12: Integration pass, retire SQL Server, deploy

**Files:**
- Delete: `deploy/mssql/Dockerfile` (and the `deploy/mssql/` directory)
- Modify: `AI_Engine/src/config/db.js` (only if integration surfaces a straggler)

**Interfaces:**
- Consumes: everything above.
- Produces: a verified, deployed AI Engine running on Postgres.

- [ ] **Step 1: Local integration run with query logging**

Start the app against Supabase with debug logging:
`cd AI_Engine && DB_DEBUG=1 npm start`
Then exercise each route group and watch for any Postgres syntax error naming a query (these are Bucket-B stragglers the shim could not auto-translate):
- Auth: register, login, Google OAuth, forgot/reset password
- Documents: list (`/documents`), detail, stats
- AI history: save, list, detail, delete, update; saved-laws; recent-docs
- Admin: stats, users list, feedback list, crawler settings
- Feedback: create
- Lawyers: list, random

For any error, fix the specific query string (same patterns as Tasks 8–9) and re-run. Commit each fix:
```bash
git commit -am "fix: convert straggler T-SQL found during integration"
```

- [ ] **Step 2: Smoke-test the critical flow**

Confirm register → login → list documents → run a chat (`/ai/ask`) works end to end. The chat result confirms `LegalDocuments` rows align with Pinecone vectors.

- [ ] **Step 3: Retire the SQL Server Dockerfile**

Run: `git rm -r deploy/mssql && git commit -m "chore: remove retired SQL Server Docker setup"`

- [ ] **Step 4: Retire the Railway SQL Server service (manual)**

In Railway → project → the `server` (SQL Server) service → Settings → Delete Service. (No code change; this stops the failing container and frees the volume.)

- [ ] **Step 5: Deploy**

- Push the branch: `git push myrepo Manh`
- Railway: the AI Engine service (root `AI_Engine`) → set `DATABASE_URL` (Supabase pooler) and the existing app env vars (`GEMINI_API_KEY`, `PINECONE_API_KEY`, `JWT_SECRET`, etc.) → deploy.
- Vercel: Frontend env `VITE_AI_API_URL` / `VITE_API_BASE_URL` → the deployed AI Engine URL.

- [ ] **Step 6: Production smoke test**

Hit the deployed AI Engine root URL (expect the "LegAI Engine is running" message), then register/login and list documents from the deployed frontend.

---

## Self-Review

**Spec coverage:**
- Compatibility shim (db.js + sql + poolConnect) → Tasks 2–6, 10. ✓
- `bit → smallint`, type mapping, lowercase columns → Task 7. ✓
- Column-casing dual mechanism (canonical keys + case-insensitive proxy) → Task 4. ✓
- Bucket A auto-translation → Task 3. ✓
- Bucket B manual (TOP, OUTPUT INSERTED) → Tasks 8–9. ✓ (CHARINDEX / SQL string-concat: none exist in the codebase; integration pass in Task 12 is the safety net.)
- Data migration (parents-first, setval, row-count verify, idempotent, preserve LegalDocuments.Id) → Task 11. ✓
- `err.number` normalization → Task 5. ✓
- Connection via Supabase pooler + ssl; remove old DB_* → Task 10. ✓
- Retire Railway SQL Server service + delete deploy/mssql → Task 12. ✓
- Testing strategy (unit + integration + row-count + smoke) → Tasks 2–7 (unit), 11 (row-count), 12 (integration/smoke). ✓

**Placeholder scan:** No TBD/TODO; each code step contains complete code. Bucket-B rewrites enumerate every affected file:line with exact before/after.

**Type consistency:** `createPool(execute)` where `execute(text, values) => {rows, rowCount}`; `.query()` returns `{recordset, recordsets, rowsAffected, output}`; `shapeRow`, `convertNamedParams`, `autoTranslateDialect`, `mapPgError`, `makeSql`, `transformRow` names match across tasks. ✓
