import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRecap } from '../scripts/session-end.mjs';

test('renderRecap omits idle suffix when idle is zero', () => {
  const out = renderRecap({
    last: {
      ts: '2026-04-28T11:00:00Z',
      duration_ms: 60 * 60_000,
      idle_ms: 0,
      input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_creation_tokens: 0,
      perLabel: [{ label: 'foo', durationMs: 60 * 60_000, idleMs: 0 }],
    },
    week: null,
  });
  assert.ok(!out.includes('idle'), 'expected no idle text');
  assert.ok(out.includes('Last session'));
  assert.ok(out.includes('foo'));
});

test('renderRecap shows idle suffix when present', () => {
  const out = renderRecap({
    last: {
      ts: '2026-04-28T11:00:00Z',
      duration_ms: 60 * 60_000,
      idle_ms: 12 * 60_000,
      input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_creation_tokens: 0,
      perLabel: [{ label: 'foo', durationMs: 30 * 60_000, idleMs: 5 * 60_000 }],
    },
    week: null,
  });
  assert.match(out, /1h 0m \(12 min idle\)/);
  assert.match(out, /foo` — 30 min \(5 min idle\)/);
});

test('renderRecap renders week section with idle when present', () => {
  const out = renderRecap({
    last: null,
    week: {
      sessions: 3,
      totalDurationMs: 3 * 60 * 60_000,
      totalIdleMs: 30 * 60_000,
      totalInputTokens: 1000, totalOutputTokens: 500,
      totalCacheReadTokens: 0, totalCacheCreationTokens: 0,
      perLabel: { foo: { durationMs: 90 * 60_000, sessions: 2, tokens: 800, idleMs: 10 * 60_000 } },
    },
  });
  assert.match(out, /This week.*\(30 min idle\)/);
  assert.match(out, /foo` — 1h 30m \(10 min idle\) across 2 session/);
});
