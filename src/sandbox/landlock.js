import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'landlock-exec.c');

/** Compile the Landlock helper when gcc and headers exist. Null if it cannot be real. */
export function landlockHelperPath() {
  if (process.platform !== 'linux') return null;
  if (!fs.existsSync('/usr/include/linux/landlock.h')) return null;
  if (!fs.existsSync(source)) return null;
  const gcc = spawnSync('gcc', ['--version'], { stdio: 'ignore' });
  if (gcc.error || gcc.status !== 0) return null;
  const hash = createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 16);
  const out = path.join(os.tmpdir(), `veor-landlock-exec-${hash}`);
  if (!fs.existsSync(out)) {
    const built = spawnSync('gcc', ['-O2', '-Wall', '-Werror', '-o', out, source], { encoding: 'utf8' });
    if (built.status !== 0) return null;
    fs.chmodSync(out, 0o755);
  }
  return out;
}
