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
