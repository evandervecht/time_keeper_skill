import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import path from 'node:path';

export function statePath(projectDir) {
  return path.join(projectDir, '.claude', 'time-keeper.state.json');
}

export async function readState(projectDir) {
  try {
    const raw = await readFile(statePath(projectDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeState(projectDir, state) {
  const p = statePath(projectDir);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(state, null, 2), 'utf8');
}

export async function clearState(projectDir) {
  try { await unlink(statePath(projectDir)); } catch {}
}

export async function stateExists(projectDir) {
  try { await access(statePath(projectDir)); return true; } catch { return false; }
}
