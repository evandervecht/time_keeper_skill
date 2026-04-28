#!/usr/bin/env node
import path from 'node:path';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { readState, clearState } from './lib/state.mjs';
import { appendJsonl } from './lib/jsonl.mjs';
import { parseTranscript } from './lib/parse-transcript.mjs';
import { updateClaudeMd } from './lib/update-claude-md.mjs';
import { buildReport } from './lib/report.mjs';
import { fmtDuration, fmtTokens } from './lib/fmt.mjs';

async function readStdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data); } catch { return {}; }
}

async function logError(cwd, err) {
  try {
    const logPath = path.join(cwd, '.claude', 'time-keeper.error.log');
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `[${new Date().toISOString()}] session-end: ${err.stack || err}\n`, 'utf8');
  } catch {}
}

const idleSuffix = (ms) => ms > 0 ? ` (${fmtDuration(ms)} idle)` : '';

export function renderRecap({ last, week }) {
  const L = [];
  L.push('## Recent time-keeper activity', '');
  if (last) {
    const date = last.ts.slice(0, 10);
    const tokens = last.input_tokens + last.output_tokens + last.cache_read_tokens + last.cache_creation_tokens;
    L.push(`**Last session** (${date}, ${fmtDuration(last.duration_ms)}${idleSuffix(last.idle_ms ?? 0)}, ${fmtTokens(tokens)} tokens)`);
    for (const tag of last.perLabel) {
      L.push(`- \`${tag.label}\` — ${fmtDuration(tag.durationMs)}${idleSuffix(tag.idleMs ?? 0)}`);
    }
    L.push('');
  }
  if (week) {
    const wkTokens = week.totalInputTokens + week.totalOutputTokens + week.totalCacheReadTokens + week.totalCacheCreationTokens;
    L.push(`**This week** (${week.sessions} sessions, ${fmtDuration(week.totalDurationMs)}${idleSuffix(week.totalIdleMs ?? 0)}, ${fmtTokens(wkTokens)} tokens)`);
    for (const [name, v] of Object.entries(week.perLabel).sort(([, a], [, b]) => b.durationMs - a.durationMs)) {
      L.push(`- \`${name}\` — ${fmtDuration(v.durationMs)}${idleSuffix(v.idleMs ?? 0)} across ${v.sessions} session(s)`);
    }
    L.push('');
  }
  L.push('_Full log: `.claude/time-keeper.jsonl`_');
  return L.join('\n');
}

async function readSessionIdle(jsonlPath, sessionId) {
  let raw;
  try { raw = await readFile(jsonlPath, 'utf8'); } catch { return { totalMs: 0, byLabel: {} }; }
  const totalsByLabel = {};
  let totalMs = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.event !== 'idle') continue;
    if (r.session_id !== sessionId) continue;
    const ms = r.duration_ms ?? 0;
    totalMs += ms;
    if (r.label) totalsByLabel[r.label] = (totalsByLabel[r.label] ?? 0) + ms;
  }
  return { totalMs, byLabel: totalsByLabel };
}

async function main() {
  const hook = await readStdinJson();
  const cwd = hook.cwd || process.cwd();
  const transcriptPath = hook.transcript_path;
  try {
    const state = await readState(cwd);
    if (!state) { process.exit(0); return; }
    const totals = transcriptPath ? await parseTranscript(transcriptPath) : {
      input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0,
    };
    const endTs = new Date().toISOString();
    const durationMs = new Date(endTs).getTime() - new Date(state.started_at).getTime();
    const tagsTouched = [...new Set((state.tag_history ?? []).map((t) => t.label).filter(Boolean))];
    const sessionRow = {
      ts: endTs,
      event: 'session',
      session_id: state.session_id,
      started_at: state.started_at,
      duration_ms: durationMs,
      git_branch: state.git_branch ?? null,
      cwd,
      ...totals,
      tags_touched: tagsTouched,
    };
    const jsonlPath = path.join(cwd, '.claude', 'time-keeper.jsonl');
    await appendJsonl(jsonlPath, sessionRow);

    const week = await buildReport(jsonlPath, { scope: 'week' });
    const idle = await readSessionIdle(jsonlPath, state.session_id);
    const labelDurations = new Map();
    const sortedTags = [...(state.tag_history ?? [])].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    for (let i = 0; i < sortedTags.length; i++) {
      const tag = sortedTags[i];
      const end = i + 1 < sortedTags.length ? new Date(sortedTags[i + 1].ts) : new Date(endTs);
      if (tag.label) {
        const ms = end - new Date(tag.ts);
        labelDurations.set(tag.label, (labelDurations.get(tag.label) ?? 0) + ms);
      }
    }
    const lastPerLabel = [...labelDurations.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([label, durationMs]) => ({ label, durationMs, idleMs: idle.byLabel[label] ?? 0 }));
    const recap = renderRecap({
      last: { ts: endTs, duration_ms: durationMs, idle_ms: idle.totalMs, ...totals, perLabel: lastPerLabel },
      week,
    });
    await updateClaudeMd(path.join(cwd, 'CLAUDE.md'), recap);
    await clearState(cwd);
  } catch (err) {
    await logError(cwd, err);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
