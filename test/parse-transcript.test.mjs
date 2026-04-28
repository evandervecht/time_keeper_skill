import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseTranscript, parseTranscriptTurns, bucketTurnsByTags, UNTAGGED } from '../scripts/lib/parse-transcript.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (n) => path.join(here, 'fixtures', n);

test('parseTranscript sums tokens across assistant turns', async () => {
  const totals = await parseTranscript(fx('transcript-basic.jsonl'));
  assert.equal(totals.input_tokens, 22);
  assert.equal(totals.output_tokens, 12);
  assert.equal(totals.cache_read_tokens, 210);
  assert.equal(totals.cache_creation_tokens, 20);
});

test('parseTranscript handles tool_use turns', async () => {
  const totals = await parseTranscript(fx('transcript-tools.jsonl'));
  assert.equal(totals.input_tokens, 42);
  assert.equal(totals.output_tokens, 19);
  assert.equal(totals.cache_read_tokens, 410);
  assert.equal(totals.cache_creation_tokens, 10);
});

test('parseTranscript skips rows with no usage', async () => {
  const totals = await parseTranscript(fx('transcript-missing-usage.jsonl'));
  assert.equal(totals.input_tokens, 8);
  assert.equal(totals.output_tokens, 3);
  assert.equal(totals.cache_read_tokens, 50);
  assert.equal(totals.cache_creation_tokens, 0);
});

test('parseTranscript on non-existent file returns zeros', async () => {
  const totals = await parseTranscript('/tmp/does-not-exist-12345.jsonl');
  assert.deepEqual(totals, {
    input_tokens: 0, output_tokens: 0,
    cache_read_tokens: 0, cache_creation_tokens: 0,
  });
});

test('parseTranscriptTurns returns per-turn data with timestamps', async () => {
  const turns = await parseTranscriptTurns(fx('transcript-with-timestamps.jsonl'));
  assert.equal(turns.length, 4);
  assert.equal(turns[0].ts, '2026-04-28T10:05:00.000Z');
  assert.equal(turns[0].input_tokens, 10);
  assert.equal(turns[3].input_tokens, 40);
});

test('bucketTurnsByTags attributes turns to active label by timestamp', async () => {
  const turns = await parseTranscriptTurns(fx('transcript-with-timestamps.jsonl'));
  const tagHistory = [
    { label: 'foo', source: 'slash', ts: '2026-04-28T10:10:00.000Z' },
    { label: 'bar', source: 'slash', ts: '2026-04-28T10:30:00.000Z' },
  ];
  const buckets = bucketTurnsByTags(turns, tagHistory, '2026-04-28T11:00:00.000Z');
  assert.equal(buckets[UNTAGGED].input_tokens, 10);
  assert.equal(buckets.foo.input_tokens, 20);
  assert.equal(buckets.bar.input_tokens, 30 + 40);
  assert.equal(buckets.bar.output_tokens, 15 + 20);
});

test('bucketTurnsByTags treats null-label tag as untagged', async () => {
  const turns = await parseTranscriptTurns(fx('transcript-with-timestamps.jsonl'));
  const tagHistory = [
    { label: 'foo', source: 'slash', ts: '2026-04-28T10:00:00.000Z' },
    { label: null, source: 'slash', ts: '2026-04-28T10:30:00.000Z' },
  ];
  const buckets = bucketTurnsByTags(turns, tagHistory, '2026-04-28T11:00:00.000Z');
  assert.equal(buckets.foo.input_tokens, 10 + 20);
  assert.equal(buckets[UNTAGGED].input_tokens, 30 + 40);
});
