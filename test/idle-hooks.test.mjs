import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { writeState, readState } from '../scripts/lib/state.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runHook(scriptRel, payload, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [path.join(repoRoot, 'scripts', scriptRel)], { cwd });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, out, err }));
    p.on('error', reject);
    p.stdin.write(JSON.stringify(payload));
    p.stdin.end();
  });
}

test('Stop sets awaiting_user_since; UserPromptSubmit writes idle row and clears it', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-idle-'));
  try {
    await writeState(dir, {
      session_id: 'sid',
      started_at: new Date(Date.now() - 60_000).toISOString(),
      cwd: dir,
      git_branch: null,
      transcript_path: null,
      current_label: 'auth-bug',
      tag_history: [{ label: 'auth-bug', source: 'slash', ts: new Date(Date.now() - 30_000).toISOString() }],
    });

    const r1 = await runHook('stop.mjs', { session_id: 'sid', cwd: dir }, dir);
    assert.equal(r1.code, 0);
    const stateAfterStop = await readState(dir);
    assert.ok(stateAfterStop.awaiting_user_since, 'expected awaiting_user_since to be set');

    await new Promise((r) => setTimeout(r, 50));

    const r2 = await runHook('user-prompt-submit.mjs', { session_id: 'sid', cwd: dir }, dir);
    assert.equal(r2.code, 0);

    const stateAfterPrompt = await readState(dir);
    assert.equal(stateAfterPrompt.awaiting_user_since, null);

    const jsonl = await readFile(path.join(dir, '.claude', 'time-keeper.jsonl'), 'utf8');
    const idleRows = jsonl.trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.event === 'idle');
    assert.equal(idleRows.length, 1);
    assert.equal(idleRows[0].session_id, 'sid');
    assert.equal(idleRows[0].label, 'auth-bug');
    assert.ok(idleRows[0].duration_ms >= 50);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('UserPromptSubmit without prior Stop writes no JSONL row but injects context', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-idle-'));
  try {
    await writeState(dir, {
      session_id: 'sid',
      started_at: new Date().toISOString(),
      cwd: dir,
      git_branch: null,
      transcript_path: null,
      current_label: null,
      tag_history: [],
    });
    const r = await runHook('user-prompt-submit.mjs', { session_id: 'sid', cwd: dir }, dir);
    assert.equal(r.code, 0);
    let jsonl = '';
    try { jsonl = await readFile(path.join(dir, '.claude', 'time-keeper.jsonl'), 'utf8'); } catch {}
    assert.equal(jsonl, '');
    assert.match(r.out, /\[time-keeper\]/);
    assert.match(r.out, /No active label/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('UserPromptSubmit injects active-label context when one is set', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-idle-'));
  try {
    await writeState(dir, {
      session_id: 'sid',
      started_at: new Date().toISOString(),
      cwd: dir,
      git_branch: null,
      transcript_path: null,
      current_label: 'fix-auth-bug',
      tag_history: [{ label: 'fix-auth-bug', source: 'slash', ts: new Date().toISOString() }],
    });
    const r = await runHook('user-prompt-submit.mjs', { session_id: 'sid', cwd: dir }, dir);
    assert.equal(r.code, 0);
    assert.match(r.out, /Active label: `fix-auth-bug`/);
    assert.match(r.out, /OLD/);
    assert.match(r.out, /NEW/);
    assert.match(r.out, /UNCLEAR/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('UserPromptSubmit without state file is silent (no time-keeper)', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-idle-'));
  try {
    const r = await runHook('user-prompt-submit.mjs', { session_id: 'sid', cwd: dir }, dir);
    assert.equal(r.code, 0);
    assert.equal(r.out, '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
