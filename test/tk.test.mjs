import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runTk } from '../scripts/tk.mjs';
import { writeState, readState } from '../scripts/lib/state.mjs';

async function tmp(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

function seededState(sessionId = 's1') {
  return {
    session_id: sessionId,
    started_at: new Date().toISOString(),
    cwd: null,
    git_branch: null,
    transcript_path: null,
    current_label: null,
    tag_history: [],
  };
}

test('tk start <label> writes tag event and sets current_label', async () => {
  await tmp(async (dir) => {
    await writeState(dir, seededState());
    const out = await runTk(['start', 'fix-auth-bug'], { cwd: dir });
    assert.match(out, /tracking/);
    const st = await readState(dir);
    assert.equal(st.current_label, 'fix-auth-bug');
    const log = await readFile(path.join(dir, '.claude', 'time-keeper.jsonl'), 'utf8');
    const row = JSON.parse(log.trim().split('\n').pop());
    assert.equal(row.event, 'tag');
    assert.equal(row.label, 'fix-auth-bug');
    assert.equal(row.source, 'slash');
  });
});

test('tk stop clears current_label and writes null-label tag', async () => {
  await tmp(async (dir) => {
    const st = seededState();
    st.current_label = 'foo';
    await writeState(dir, st);
    await runTk(['stop'], { cwd: dir });
    const after = await readState(dir);
    assert.equal(after.current_label, null);
    const log = await readFile(path.join(dir, '.claude', 'time-keeper.jsonl'), 'utf8');
    const row = JSON.parse(log.trim().split('\n').pop());
    assert.equal(row.label, null);
    assert.equal(row.previous_label, 'foo');
  });
});

test('tk status without state prints no-session message', async () => {
  await tmp(async (dir) => {
    const out = await runTk(['status'], { cwd: dir });
    assert.match(out, /no active time-keeper session/i);
  });
});

test('tk status with state reports elapsed and current label', async () => {
  await tmp(async (dir) => {
    const st = seededState();
    st.started_at = new Date(Date.now() - 90_000).toISOString();
    st.current_label = 'foo';
    await writeState(dir, st);
    const out = await runTk(['status'], { cwd: dir });
    assert.match(out, /foo/);
    assert.match(out, /\d+ min|\d+s/);
  });
});
