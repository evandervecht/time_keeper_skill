import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildReport } from '../scripts/lib/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

async function withJsonl(rows, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-'));
  const p = path.join(dir, 'time-keeper.jsonl');
  await writeFile(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  try { return await fn(p); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('report groups session totals by label via tag timestamps', async () => {
  const sessionStart = '2026-04-24T10:00:00Z';
  const sessionEnd = '2026-04-24T11:00:00Z';
  const tag1 = '2026-04-24T10:00:00Z';
  const tag2 = '2026-04-24T10:30:00Z';

  await withJsonl(
    [
      { ts: tag1, event: 'tag', session_id: 's1', label: 'foo', source: 'slash', previous_label: null },
      { ts: tag2, event: 'tag', session_id: 's1', label: 'bar', source: 'slash', previous_label: 'foo' },
      {
        ts: sessionEnd, event: 'session', session_id: 's1',
        started_at: sessionStart, duration_ms: 3_600_000,
        input_tokens: 100, output_tokens: 50,
        cache_read_tokens: 1000, cache_creation_tokens: 20,
        tags_touched: ['foo', 'bar'],
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'all' });
      assert.equal(r.sessions, 1);
      assert.equal(r.totalDurationMs, 3_600_000);
      assert.equal(r.totalInputTokens, 100);
      assert.equal(r.perLabel.foo.durationMs, 30 * 60_000);
      assert.equal(r.perLabel.bar.durationMs, 30 * 60_000);
      assert.equal(r.bySession.length, 1);
      assert.equal(r.bySession[0].session_id, 's1');
      assert.equal(r.bySession[0].tokens, 100 + 50 + 1000 + 20);
      // pro-rated tokens per tag (50/50 duration split)
      const expected = Math.round((100 + 50 + 1000 + 20) / 2);
      assert.equal(r.perLabel.foo.tokens, expected);
      assert.equal(r.perLabel.bar.tokens, expected);
    }
  );
});

test('report filters by label', async () => {
  const base = '2026-04-24T10:00:00Z';
  await withJsonl(
    [
      { ts: base, event: 'tag', session_id: 's1', label: 'foo', source: 'slash', previous_label: null },
      {
        ts: '2026-04-24T11:00:00Z', event: 'session', session_id: 's1',
        started_at: base, duration_ms: 3_600_000,
        input_tokens: 100, output_tokens: 50,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: ['foo'],
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'all', label: 'foo' });
      assert.equal(r.perLabel.foo.durationMs, 3_600_000);
      assert.equal(Object.keys(r.perLabel).length, 1);
    }
  );
});

test('per-tag tokens use session.tag_tokens when present (exact, not pro-rated)', async () => {
  const start = '2026-04-28T10:00:00Z';
  const end = '2026-04-28T11:00:00Z';
  await withJsonl(
    [
      { ts: start, event: 'tag', session_id: 's1', label: 'foo', source: 'slash', previous_label: null },
      { ts: '2026-04-28T10:30:00Z', event: 'tag', session_id: 's1', label: 'bar', source: 'slash', previous_label: 'foo' },
      {
        ts: end, event: 'session', session_id: 's1',
        started_at: start, duration_ms: 3_600_000,
        input_tokens: 1000, output_tokens: 500,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: ['foo', 'bar'],
        tag_tokens: {
          foo: { input_tokens: 900, output_tokens: 400, cache_read_tokens: 0, cache_creation_tokens: 0 },
          bar: { input_tokens: 100, output_tokens: 100, cache_read_tokens: 0, cache_creation_tokens: 0 },
        },
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'all' });
      assert.equal(r.perLabel.foo.tokens, 1300);
      assert.equal(r.perLabel.bar.tokens, 200);
      assert.equal(r.perLabel.foo.exact, true);
      assert.equal(r.perLabel.bar.exact, true);
    }
  );
});

test('per-tag tokens fall back to pro-rating when tag_tokens is absent', async () => {
  const start = '2026-04-28T10:00:00Z';
  const end = '2026-04-28T11:00:00Z';
  await withJsonl(
    [
      { ts: start, event: 'tag', session_id: 's1', label: 'foo', source: 'slash', previous_label: null },
      {
        ts: end, event: 'session', session_id: 's1',
        started_at: start, duration_ms: 3_600_000,
        input_tokens: 100, output_tokens: 50,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: ['foo'],
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'all' });
      assert.equal(r.perLabel.foo.tokens, 150);
      assert.equal(r.perLabel.foo.exact, false);
    }
  );
});

test('idle events aggregate into total, per-session, and per-tag', async () => {
  const start = '2026-04-28T10:00:00Z';
  const end = '2026-04-28T11:00:00Z';
  await withJsonl(
    [
      { ts: start, event: 'tag', session_id: 's1', label: 'foo', source: 'slash', previous_label: null },
      { ts: '2026-04-28T10:15:00Z', event: 'idle', session_id: 's1', label: 'foo', duration_ms: 60_000 },
      { ts: '2026-04-28T10:45:00Z', event: 'idle', session_id: 's1', label: 'foo', duration_ms: 120_000 },
      {
        ts: end, event: 'session', session_id: 's1',
        started_at: start, duration_ms: 3_600_000,
        input_tokens: 10, output_tokens: 5,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: ['foo'],
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'all' });
      assert.equal(r.totalIdleMs, 180_000);
      assert.equal(r.bySession[0].idle_ms, 180_000);
      assert.equal(r.perLabel.foo.idleMs, 180_000);
    }
  );
});

test('report includes in-flight session from currentState when no session row exists', async () => {
  const tagTs = '2026-04-28T10:00:00Z';
  const now = new Date('2026-04-28T11:00:00Z');
  await withJsonl(
    [
      { ts: tagTs, event: 'tag', session_id: 'live', label: 'wip', source: 'slash', previous_label: null },
    ],
    async (p) => {
      const currentState = {
        session_id: 'live',
        started_at: '2026-04-28T09:30:00Z',
        tag_history: [{ label: 'wip', source: 'slash', ts: tagTs }],
      };
      const r = await buildReport(p, { scope: 'all', currentState, now });
      assert.equal(r.sessions, 1);
      assert.equal(r.perLabel.wip.durationMs, 60 * 60_000);
    }
  );
});

test('in-flight session reports live tokens parsed from transcript_path', async () => {
  const tagTs = '2026-04-28T10:00:00Z';
  const now = new Date('2026-04-28T11:00:00Z');
  const transcriptPath = path.join(here, 'fixtures', 'transcript-basic.jsonl');
  await withJsonl(
    [{ ts: tagTs, event: 'tag', session_id: 'live', label: 'wip', source: 'slash', previous_label: null }],
    async (p) => {
      const currentState = {
        session_id: 'live',
        started_at: '2026-04-28T09:30:00Z',
        transcript_path: transcriptPath,
        tag_history: [{ label: 'wip', source: 'slash', ts: tagTs }],
      };
      const r = await buildReport(p, { scope: 'all', currentState, now });
      assert.equal(r.totalInputTokens, 22);
      assert.equal(r.totalOutputTokens, 12);
      assert.equal(r.totalCacheReadTokens, 210);
    }
  );
});

test('report with --week filters sessions outside 7-day window', async () => {
  const now = new Date('2026-04-24T12:00:00Z');
  const old = '2026-04-01T12:00:00Z';
  const fresh = '2026-04-23T12:00:00Z';
  await withJsonl(
    [
      {
        ts: old, event: 'session', session_id: 'old',
        started_at: old, duration_ms: 1_000,
        input_tokens: 999, output_tokens: 0,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: [],
      },
      {
        ts: fresh, event: 'session', session_id: 'fresh',
        started_at: fresh, duration_ms: 2_000,
        input_tokens: 1, output_tokens: 0,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: [],
      },
    ],
    async (p) => {
      const r = await buildReport(p, { scope: 'week', now });
      assert.equal(r.sessions, 1);
      assert.equal(r.totalInputTokens, 1);
    }
  );
});
