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
