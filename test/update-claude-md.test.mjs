import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { updateClaudeMd, START_MARKER, END_MARKER } from '../scripts/lib/update-claude-md.mjs';

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tk-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('creates CLAUDE.md with block when file does not exist', async () => {
  await withTmp(async (dir) => {
    const p = path.join(dir, 'CLAUDE.md');
    await updateClaudeMd(p, 'BODY');
    const content = await readFile(p, 'utf8');
    assert.ok(content.includes(START_MARKER));
    assert.ok(content.includes(END_MARKER));
    assert.ok(content.includes('BODY'));
  });
});

test('appends block with blank line when file exists without markers', async () => {
  await withTmp(async (dir) => {
    const p = path.join(dir, 'CLAUDE.md');
    await writeFile(p, '# Existing\n\nuser content\n', 'utf8');
    await updateClaudeMd(p, 'BODY');
    const content = await readFile(p, 'utf8');
    assert.ok(content.startsWith('# Existing\n\nuser content\n'));
    assert.ok(content.includes(START_MARKER));
    assert.ok(content.includes('BODY'));
  });
});

test('replaces only content between existing markers', async () => {
  await withTmp(async (dir) => {
    const p = path.join(dir, 'CLAUDE.md');
    const before = `# Keep me\n\n${START_MARKER}\nOLD BODY\n${END_MARKER}\n\n# Also keep\n`;
    await writeFile(p, before, 'utf8');
    await updateClaudeMd(p, 'NEW BODY');
    const content = await readFile(p, 'utf8');
    assert.ok(content.startsWith('# Keep me\n\n'));
    assert.ok(content.endsWith('# Also keep\n'));
    assert.ok(content.includes('NEW BODY'));
    assert.ok(!content.includes('OLD BODY'));
  });
});

test('refuses to write when only one marker is present', async () => {
  await withTmp(async (dir) => {
    const p = path.join(dir, 'CLAUDE.md');
    const before = `# User\n\n${START_MARKER}\ndangling\n`;
    await writeFile(p, before, 'utf8');
    await assert.rejects(() => updateClaudeMd(p, 'BODY'), /marker/i);
    const content = await readFile(p, 'utf8');
    assert.equal(content, before);
  });
});
