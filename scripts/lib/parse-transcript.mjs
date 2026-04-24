import { readFile } from 'node:fs/promises';

export async function parseTranscript(transcriptPath) {
  const zero = {
    input_tokens: 0, output_tokens: 0,
    cache_read_tokens: 0, cache_creation_tokens: 0,
  };
  let raw;
  try {
    raw = await readFile(transcriptPath, 'utf8');
  } catch {
    return zero;
  }
  const totals = { ...zero };
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row?.type !== 'assistant') continue;
    const usage = row?.message?.usage;
    if (!usage) continue;
    totals.input_tokens += usage.input_tokens ?? 0;
    totals.output_tokens += usage.output_tokens ?? 0;
    totals.cache_read_tokens += usage.cache_read_input_tokens ?? 0;
    totals.cache_creation_tokens += usage.cache_creation_input_tokens ?? 0;
  }
  return totals;
}
