import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function appendJsonl(filePath, obj) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, JSON.stringify(obj) + '\n', 'utf8');
}
