const { test } = require('node:test');
const assert = require('node:assert');

test('pg is importable', () => {
  const pg = require('pg');
  assert.ok(pg.Pool, 'pg.Pool should exist');
});
