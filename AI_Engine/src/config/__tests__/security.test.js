const { test } = require('node:test');
const assert = require('node:assert');
const { isAllowedOrigin } = require('../security');

test('allows non-browser callers (no Origin header)', () => {
  assert.ok(isAllowedOrigin(undefined));
  assert.ok(isAllowedOrigin(''));
});

test('allows the configured Vercel production origin', () => {
  assert.ok(isAllowedOrigin('https://legal-ai-assistant-manh301.vercel.app'));
});

test('allows any *.vercel.app (preview/redeploy URLs)', () => {
  assert.ok(isAllowedOrigin('https://legal-ai-assistant-git-manh.vercel.app'));
});

test('allows localhost dev origins', () => {
  assert.ok(isAllowedOrigin('http://localhost:5173'));
});

test('blocks unrelated third-party origins', () => {
  assert.ok(!isAllowedOrigin('https://evil.example.com'));
  assert.ok(!isAllowedOrigin('https://vercel.app.attacker.com'));
});
