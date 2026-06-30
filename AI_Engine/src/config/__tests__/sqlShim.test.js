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
