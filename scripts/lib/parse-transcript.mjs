import { readFile } from 'node:fs/promises';

const ZERO = {
  input_tokens: 0, output_tokens: 0,
  cache_read_tokens: 0, cache_creation_tokens: 0,
};

export async function parseTranscriptTurns(transcriptPath) {
  let raw;
  try { raw = await readFile(transcriptPath, 'utf8'); }
  catch { return []; }
  const turns = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row?.type !== 'assistant') continue;
    const usage = row?.message?.usage;
    if (!usage) continue;
    turns.push({
      ts: row.timestamp ?? null,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
    });
  }
  return turns;
}

export async function parseTranscript(transcriptPath) {
  const turns = await parseTranscriptTurns(transcriptPath);
  return turns.reduce((acc, t) => ({
    input_tokens: acc.input_tokens + t.input_tokens,
    output_tokens: acc.output_tokens + t.output_tokens,
    cache_read_tokens: acc.cache_read_tokens + t.cache_read_tokens,
    cache_creation_tokens: acc.cache_creation_tokens + t.cache_creation_tokens,
  }), { ...ZERO });
}

export const UNTAGGED = '__untagged__';

export function bucketTurnsByTags(turns, tagHistory, sessionEndTime = null) {
  const buckets = {};
  const addZero = (key) => {
    if (!buckets[key]) buckets[key] = { ...ZERO };
    return buckets[key];
  };
  const sortedTags = [...(tagHistory ?? [])].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const endTs = sessionEndTime ? new Date(sessionEndTime) : new Date(8.64e15);

  for (const turn of turns) {
    if (!turn.ts) {
      const b = addZero(UNTAGGED);
      b.input_tokens += turn.input_tokens;
      b.output_tokens += turn.output_tokens;
      b.cache_read_tokens += turn.cache_read_tokens;
      b.cache_creation_tokens += turn.cache_creation_tokens;
      continue;
    }
    const turnTs = new Date(turn.ts);
    let activeLabel = UNTAGGED;
    for (let i = 0; i < sortedTags.length; i++) {
      const tagStart = new Date(sortedTags[i].ts);
      const tagEnd = i + 1 < sortedTags.length ? new Date(sortedTags[i + 1].ts) : endTs;
      if (turnTs >= tagStart && turnTs < tagEnd) {
        activeLabel = sortedTags[i].label ?? UNTAGGED;
        break;
      }
    }
    const b = addZero(activeLabel);
    b.input_tokens += turn.input_tokens;
    b.output_tokens += turn.output_tokens;
    b.cache_read_tokens += turn.cache_read_tokens;
    b.cache_creation_tokens += turn.cache_creation_tokens;
  }
  return buckets;
}
