#!/usr/bin/env node
import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { readState, writeState } from './lib/state.mjs';
import { appendJsonl } from './lib/jsonl.mjs';

async function readStdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data); } catch { return {}; }
}

async function logError(cwd, err) {
  try {
    const logPath = path.join(cwd, '.claude', 'time-keeper.error.log');
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `[${new Date().toISOString()}] user-prompt-submit: ${err.stack || err}\n`, 'utf8');
  } catch {}
}

async function main() {
  const hook = await readStdinJson();
  const cwd = hook.cwd || process.cwd();
  try {
    const state = await readState(cwd);
    if (!state || !state.awaiting_user_since) { process.exit(0); return; }
    const now = new Date();
    const since = new Date(state.awaiting_user_since);
    const duration_ms = now - since;
    if (duration_ms > 0) {
      await appendJsonl(path.join(cwd, '.claude', 'time-keeper.jsonl'), {
        ts: now.toISOString(),
        event: 'idle',
        session_id: state.session_id,
        label: state.current_label ?? null,
        duration_ms,
      });
    }
    state.awaiting_user_since = null;
    await writeState(cwd, state);
  } catch (err) {
    await logError(cwd, err);
  }
  process.exit(0);
}

main();
