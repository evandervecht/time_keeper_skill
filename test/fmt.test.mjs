import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDuration, fmtTokens } from '../scripts/lib/fmt.mjs';

test('fmtDuration sub-minute', () => {
  assert.equal(fmtDuration(45_000), '45s');
});
test('fmtDuration minutes', () => {
  assert.equal(fmtDuration(47 * 60_000), '47 min');
});
test('fmtDuration hours and minutes', () => {
  assert.equal(fmtDuration(3611_000), '1h 0m');
  assert.equal(fmtDuration(2 * 3600_000 + 47 * 60_000), '2h 47m');
});

test('fmtTokens under 1k', () => {
  assert.equal(fmtTokens(512), '512');
});
test('fmtTokens kilo', () => {
  assert.equal(fmtTokens(12345), '12k');
});
test('fmtTokens mega', () => {
  assert.equal(fmtTokens(2_123_456), '2.1M');
});
