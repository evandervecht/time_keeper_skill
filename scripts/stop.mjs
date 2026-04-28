#!/usr/bin/env node
import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { readState, writeState } from './lib/state.mjs';

async function readStdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data); } catch { return {}; }
}

async function logError(cwd, err) {
  try {
    const logPath = path.join(cwd, '.claude', 'time-keeper.error.log');
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `[${new Date().toISOString()}] stop: ${err.stack || err}\n`, 'utf8');
  } catch {}
}

async function main() {
  const hook = await readStdinJson();
  const cwd = hook.cwd || process.cwd();
  try {
    const state = await readState(cwd);
    if (!state) { process.exit(0); return; }
    state.awaiting_user_since = new Date().toISOString();
    await writeState(cwd, state);
  } catch (err) {
    await logError(cwd, err);
  }
  process.exit(0);
}

main();
