import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthNext } from '../app/lib/auth-navigation.ts';

test('preserves same-site destinations and draft query parameters', () => {
  assert.equal(safeAuthNext('/story?step=3#photos'), '/story?step=3#photos');
  assert.equal(safeAuthNext('/studio?order=example'), '/studio?order=example');
});
test('preserves the selected application plan through an encoded authentication callback', () => {
  for (const plan of ['video-only', 'memory-film']) {
    const nextPath = `/story?plan=${plan}`;
    const authUrl = new URL('/auth', 'https://www.wanmemory.com');
    authUrl.searchParams.set('next', safeAuthNext(nextPath));
    assert.equal(safeAuthNext(authUrl.searchParams.get('next')), nextPath);
  }
});
test('rejects external and browser-normalized redirect targets', () => {
  for (const value of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\n/evil.example']) {
    assert.equal(safeAuthNext(value), '/studio');
  }
});
