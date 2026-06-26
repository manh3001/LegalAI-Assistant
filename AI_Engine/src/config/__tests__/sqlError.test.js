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
