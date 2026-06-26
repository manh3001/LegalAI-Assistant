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
