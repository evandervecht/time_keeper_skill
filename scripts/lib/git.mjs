import { spawn } from 'node:child_process';

export function detectGitBranch(cwd) {
  return new Promise((resolve) => {
    let p;
    try {
      p = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    } catch {
      return resolve(null);
    }
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const branch = out.trim();
      resolve(branch || null);
    });
    p.on('error', () => resolve(null));
  });
}
