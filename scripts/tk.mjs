#!/usr/bin/env node
import path from 'node:path';
import { readState, writeState } from './lib/state.mjs';
import { appendJsonl } from './lib/jsonl.mjs';
import { buildReport } from './lib/report.mjs';
import { fmtDuration, fmtTokens } from './lib/fmt.mjs';

function jsonlPath(cwd) { return path.join(cwd, '.claude', 'time-keeper.jsonl'); }

async function writeTag(cwd, { label, source }) {
  const state = (await readState(cwd)) ?? null;
  const previous = state?.current_label ?? null;
  const row = {
    ts: new Date().toISOString(),
    event: 'tag',
    session_id: state?.session_id ?? null,
    label,
    source,
    git_branch: state?.git_branch ?? null,
    previous_label: previous,
  };
  await appendJsonl(jsonlPath(cwd), row);
  if (state) {
    state.current_label = label;
    state.tag_history = [...(state.tag_history ?? []), { label, source, ts: row.ts }];
    await writeState(cwd, state);
  }
}

async function cmdStart(cwd, label, source = 'slash') {
  if (!label) return 'error: /time-keeper:start requires a label';
  await writeTag(cwd, { label, source });
  return `⏱ tracking ${label}`;
}

async function cmdStop(cwd) {
  await writeTag(cwd, { label: null, source: 'slash' });
  return '⏱ tag cleared';
}

async function cmdTag(cwd, label) {
  if (!label) return 'error: /time-keeper:tag requires a label';
  await writeTag(cwd, { label, source: 'slash' });
  return `⏱ switched to ${label}`;
}

async function cmdStatus(cwd) {
  const state = await readState(cwd);
  if (!state) return 'no active time-keeper session';
  const elapsed = Date.now() - new Date(state.started_at).getTime();
  const lines = [
    `session: ${fmtDuration(elapsed)} elapsed`,
    `current label: ${state.current_label ?? '(none)'}`,
  ];
  if (state.tag_history?.length) {
    lines.push(`tags this session: ${state.tag_history.map((t) => t.label ?? '(stop)').join(', ')}`);
  }
  return lines.join('\n');
}

async function cmdReport(cwd, args) {
  const scope = args.includes('--week') ? 'week' : args.includes('--month') ? 'month' : 'all';
  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : null;
  const currentState = await readState(cwd);
  const r = await buildReport(jsonlPath(cwd), { scope, label, currentState });
  const totalTokens = r.totalInputTokens + r.totalOutputTokens + r.totalCacheReadTokens + r.totalCacheCreationTokens;

  const lines = [`time-keeper report (${scope})`];
  if (currentState) lines.push('(includes current in-flight session)');

  lines.push('', 'OVERALL', `  ${r.sessions} session(s)  ${fmtDuration(r.totalDurationMs)}  ${fmtTokens(totalTokens)} tokens`);

  if (r.bySession.length) {
    lines.push('', 'PER SESSION');
    const sessions = [...r.bySession].sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sessions) {
      const flag = s.in_flight ? '  ⏱ in-flight' : '';
      const branch = s.git_branch ? `  (${s.git_branch})` : '';
      lines.push(`  ${s.date}  ${fmtDuration(s.duration_ms)}  ${fmtTokens(s.tokens)} tokens${branch}${flag}`);
    }
  }

  const labels = Object.entries(r.perLabel).sort(([, a], [, b]) => b.durationMs - a.durationMs);
  if (labels.length) {
    lines.push('', 'PER TAG');
    for (const [name, v] of labels) {
      lines.push(`  ${name}  ${fmtDuration(v.durationMs)}  ~${fmtTokens(v.tokens)} tokens (est, pro-rated by duration)`);
    }
  } else {
    lines.push('', '(no tagged segments in scope)');
  }

  return lines.join('\n');
}

export async function runTk(argv, { cwd = process.cwd() } = {}) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'start':  return cmdStart(cwd, rest[0]);
    case 'stop':   return cmdStop(cwd);
    case 'tag':    return cmdTag(cwd, rest[0]);
    case 'status': return cmdStatus(cwd);
    case 'report': return cmdReport(cwd, rest);
    default:       return `unknown subcommand: ${sub}`;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await runTk(process.argv.slice(2));
  process.stdout.write(out + '\n');
}
