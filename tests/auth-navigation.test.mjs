import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthNext } from '../app/lib/auth-navigation.ts';

test('preserves same-site destinations and draft query parameters', () => {
  assert.equal(safeAuthNext('/story?step=3#photos'), '/story?step=3#photos');
  assert.equal(safeAuthNext('/studio?order=example'), '/studio?order=example');
});
test('rejects external and browser-normalized redirect targets', () => {
  for (const value of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\n/evil.example']) {
    assert.equal(safeAuthNext(value), '/studio');
  }
});
