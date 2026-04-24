import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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

test('end-to-end: session-start → tag → session-end produces JSONL + CLAUDE.md', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tke2e-'));
  try {
    await mkdir(path.join(dir, 't'), { recursive: true });
    const transcriptPath = path.join(dir, 't', 'transcript.jsonl');
    await writeFile(
      transcriptPath,
      [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'hello' }],
            usage: { input_tokens: 50, output_tokens: 25, cache_read_input_tokens: 500, cache_creation_input_tokens: 10 },
          },
        }),
      ].join('\n') + '\n',
      'utf8'
    );

    const startPayload = { session_id: 'sess-e2e', cwd: dir, transcript_path: transcriptPath };
    const r1 = await runHook('session-start.mjs', startPayload, dir);
    assert.equal(r1.code, 0);

    const { runTk } = await import(path.join(repoRoot, 'scripts', 'tk.mjs'));
    await runTk(['start', 'e2e-feature'], { cwd: dir });

    const endPayload = { session_id: 'sess-e2e', cwd: dir, transcript_path: transcriptPath };
    const r2 = await runHook('session-end.mjs', endPayload, dir);
    assert.equal(r2.code, 0);

    const jsonl = await readFile(path.join(dir, '.claude', 'time-keeper.jsonl'), 'utf8');
    const lines = jsonl.trim().split('\n').map((l) => JSON.parse(l));
    const sessionRow = lines.find((r) => r.event === 'session');
    assert.ok(sessionRow, 'expected session row');
    assert.equal(sessionRow.input_tokens, 50);
    assert.equal(sessionRow.output_tokens, 25);
    assert.equal(sessionRow.cache_read_tokens, 500);
    assert.equal(sessionRow.cache_creation_tokens, 10);
    assert.deepEqual(sessionRow.tags_touched, ['e2e-feature']);

    const claudeMd = await readFile(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /time-keeper:recap START/);
    assert.match(claudeMd, /time-keeper:recap END/);
    assert.match(claudeMd, /e2e-feature/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
