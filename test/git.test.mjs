import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { detectGitBranch } from '../scripts/lib/git.mjs';

function runCmd(cmd, args, opts) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, opts);
    p.on('close', (code) => resolve(code));
    p.on('error', () => resolve(-1));
  });
}

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-git-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('detectGitBranch returns branch name in a git repo', async () => {
  await withTmp(async (dir) => {
    await runCmd('git', ['init', '-q', '-b', 'feature/x'], { cwd: dir });
    await writeFile(path.join(dir, 'a.txt'), 'a', 'utf8');
    await runCmd('git', ['add', '.'], { cwd: dir });
    await runCmd('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'i'], { cwd: dir });
    const branch = await detectGitBranch(dir);
    assert.equal(branch, 'feature/x');
  });
});

test('detectGitBranch returns null in a non-git directory', async () => {
  await withTmp(async (dir) => {
    const branch = await detectGitBranch(dir);
    assert.equal(branch, null);
  });
});
