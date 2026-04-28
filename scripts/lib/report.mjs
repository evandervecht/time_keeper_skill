import { readFile } from 'node:fs/promises';

function windowStart(scope, now) {
  const d = new Date(now);
  if (scope === 'week') d.setUTCDate(d.getUTCDate() - 7);
  else if (scope === 'month') d.setUTCDate(d.getUTCDate() - 30);
  else return new Date(0);
  return d;
}

export async function buildReport(jsonlPath, { scope = 'all', label = null, now = new Date(), currentState = null } = {}) {
  let raw = '';
  try { raw = await readFile(jsonlPath, 'utf8'); }
  catch { /* missing file is fine — may still have currentState */ }
  const rows = raw.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  const cutoff = windowStart(scope, now);
  const perSession = new Map();
  for (const row of rows) {
    if (!row.session_id) continue;
    const rowTs = new Date(row.ts);
    if (rowTs < cutoff) continue;
    if (!perSession.has(row.session_id)) perSession.set(row.session_id, { tags: [], session: null });
    const entry = perSession.get(row.session_id);
    if (row.event === 'tag') entry.tags.push(row);
    if (row.event === 'session') entry.session = row;
  }

  if (currentState?.session_id && !perSession.get(currentState.session_id)?.session) {
    const sid = currentState.session_id;
    const entry = perSession.get(sid) ?? { tags: [], session: null };
    const startedAt = new Date(currentState.started_at);
    const nowDate = new Date(now);
    if (startedAt >= cutoff) {
      entry.session = {
        ts: nowDate.toISOString(),
        event: 'session',
        session_id: sid,
        started_at: currentState.started_at,
        duration_ms: nowDate - startedAt,
        input_tokens: 0, output_tokens: 0,
        cache_read_tokens: 0, cache_creation_tokens: 0,
        tags_touched: [...new Set((currentState.tag_history ?? []).map((t) => t.label).filter(Boolean))],
        in_flight: true,
      };
      perSession.set(sid, entry);
    }
  }

  const report = empty();
  const perLabel = {};

  for (const { tags, session } of perSession.values()) {
    if (!session) continue;
    report.sessions++;
    report.totalDurationMs += session.duration_ms ?? 0;
    report.totalInputTokens += session.input_tokens ?? 0;
    report.totalOutputTokens += session.output_tokens ?? 0;
    report.totalCacheReadTokens += session.cache_read_tokens ?? 0;
    report.totalCacheCreationTokens += session.cache_creation_tokens ?? 0;

    const sortedTags = [...tags].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const endTs = new Date(session.ts);
    const bounds = [];
    for (let i = 0; i < sortedTags.length; i++) {
      const start = new Date(sortedTags[i].ts);
      const end = i + 1 < sortedTags.length ? new Date(sortedTags[i + 1].ts) : endTs;
      bounds.push({ label: sortedTags[i].label, ms: end - start });
    }
    for (const b of bounds) {
      if (!b.label) continue;
      if (label && b.label !== label) continue;
      if (!perLabel[b.label]) perLabel[b.label] = { durationMs: 0, sessions: new Set() };
      perLabel[b.label].durationMs += b.ms;
      perLabel[b.label].sessions.add(session.session_id);
    }
  }

  for (const k of Object.keys(perLabel)) {
    perLabel[k] = { durationMs: perLabel[k].durationMs, sessions: perLabel[k].sessions.size };
  }
  report.perLabel = perLabel;
  return report;
}

function empty() {
  return {
    sessions: 0,
    totalDurationMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    perLabel: {},
  };
}
