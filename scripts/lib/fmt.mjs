export function fmtDuration(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export function fmtTokens(n) {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
