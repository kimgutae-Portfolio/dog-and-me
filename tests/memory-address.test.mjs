import test from 'node:test';
import assert from 'node:assert/strict';
import { isMemoryAddress, memoryAddressPath } from '../app/lib/memory-address.ts';

test('customer picks their own words, without requiring an English pet name', () => {
  for (const value of ['moka', 'my-lovely-dog', 'moka-and-me', '123', 'a'.repeat(40)]) {
    assert.equal(isMemoryAddress(value), true, value);
    assert.equal(memoryAddressPath(value), `/memory/${value}`);
  }
});
test('rejects email addresses, path injection, reserved names and ambiguous formatting', () => {
  for (const value of ['', 'ab', 'a'.repeat(41), 'Moka', 'モカ', 'a@b.com', 'my dog',
    'a/b', '../admin', 'a%2fb', '-dog', 'dog-', 'my--dog', 'admin', 'preview']) {
    assert.equal(isMemoryAddress(value), false, value);
  }
});
