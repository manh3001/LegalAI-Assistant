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
