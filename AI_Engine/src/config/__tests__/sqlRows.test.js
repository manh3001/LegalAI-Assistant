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
