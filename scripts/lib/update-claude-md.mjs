import { readFile, writeFile, access } from 'node:fs/promises';

export const START_MARKER = '<!-- time-keeper:recap START — managed by time-keeper plugin, do not edit -->';
export const END_MARKER = '<!-- time-keeper:recap END -->';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

export async function updateClaudeMd(filePath, body) {
  const block = `${START_MARKER}\n${body}\n${END_MARKER}`;
  if (!(await exists(filePath))) {
    await writeFile(filePath, block + '\n', 'utf8');
    return;
  }
  const content = await readFile(filePath, 'utf8');
  const hasStart = content.includes(START_MARKER);
  const hasEnd = content.includes(END_MARKER);
  if (hasStart !== hasEnd) {
    throw new Error(
      `CLAUDE.md has exactly one time-keeper marker — refusing to overwrite. Restore both markers or remove both.`
    );
  }
  if (hasStart && hasEnd) {
    const startIdx = content.indexOf(START_MARKER);
    const endIdx = content.indexOf(END_MARKER) + END_MARKER.length;
    const next = content.slice(0, startIdx) + block + content.slice(endIdx);
    await writeFile(filePath, next, 'utf8');
    return;
  }
  const sep = content.endsWith('\n') ? '\n' : '\n\n';
  await writeFile(filePath, content + sep + block + '\n', 'utf8');
}
