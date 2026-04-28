#!/usr/bin/env node
import { writeState } from './lib/state.mjs';
import { detectGitBranch } from './lib/git.mjs';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function readStdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data); } catch { return {}; }
}

async function logError(cwd, err) {
  try {
    const logPath = path.join(cwd, '.claude', 'time-keeper.error.log');
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `[${new Date().toISOString()}] session-start: ${err.stack || err}\n`, 'utf8');
  } catch {}
}

async function main() {
  const hook = await readStdinJson();
  const cwd = hook.cwd || process.cwd();
  try {
    const git_branch = await detectGitBranch(cwd);
    await writeState(cwd, {
      session_id: hook.session_id ?? null,
      started_at: new Date().toISOString(),
      cwd,
      git_branch,
      transcript_path: hook.transcript_path ?? null,
      current_label: null,
      tag_history: [],
    });
  } catch (err) {
    await logError(cwd, err);
  }
  process.exit(0);
}

main();
