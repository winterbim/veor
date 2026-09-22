import { spawn } from 'node:child_process';
import path from 'node:path';
import { hashObject } from '../canonical.js';

function boundedCollector(limit) {
  let bytes = 0;
  const chunks = [];
  return {
    push(chunk) {
      if (bytes >= limit) return;
      const buf = Buffer.from(chunk);
      const left = limit - bytes;
      chunks.push(buf.subarray(0, left));
      bytes += Math.min(buf.length, left);
    },
    text() { return Buffer.concat(chunks).toString('utf8'); },
    truncated() { return bytes >= limit; },
  };
}

export class ProcessSandbox {
  constructor({ cwd, timeoutMs = 30_000, maxOutputBytes = 1_000_000, envAllowlist = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR'], requireOsIsolation = false } = {}) {
    // Honest fail-closed: process backend never provides OS isolation.
    // Do not construct this class when policy requires osEnforced.
    if (requireOsIsolation) {
      throw new Error('OS isolation required; process backend cannot enforce it (osEnforced would be false)');
    }
    this.cwd = path.resolve(cwd ?? process.cwd());
    this.timeoutMs = timeoutMs;
    this.maxOutputBytes = maxOutputBytes;
    this.envAllowlist = envAllowlist;
  }
  describe() {
    return { backend: 'process', isolation: 'none', osEnforced: false, networkIsolated: false, filesystemIsolated: false };
  }
  async exec(argv, { cwd = this.cwd, env = {}, timeoutMs = this.timeoutMs } = {}) {
    if (!Array.isArray(argv) || !argv.length || argv.some(x => typeof x !== 'string')) throw new Error('argv must be a non-empty string array');
    const safeEnv = {};
    for (const key of this.envAllowlist) if (process.env[key] != null) safeEnv[key] = process.env[key];
    Object.assign(safeEnv, env);
    const startedAt = new Date().toISOString();
    const stdout = boundedCollector(this.maxOutputBytes);
    const stderr = boundedCollector(this.maxOutputBytes);
    return await new Promise((resolve) => {
      const child = spawn(argv[0], argv.slice(1), { cwd: path.resolve(cwd), env: safeEnv, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      child.stdout.on('data', c => stdout.push(c)); child.stderr.on('data', c => stderr.push(c));
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
      child.on('error', error => { clearTimeout(timer); resolve({ ok:false, code:'SPAWN_ERROR', error:error.message, startedAt, completedAt:new Date().toISOString(), sandbox:this.describe() }); });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const out = { ok: !timedOut && code === 0, code: timedOut ? 'TIMEOUT' : code, signal, stdout: stdout.text(), stderr: stderr.text(), truncated: stdout.truncated() || stderr.truncated(), startedAt, completedAt:new Date().toISOString(), sandbox:this.describe() };
        out.resultDigest = hashObject({ code: out.code, signal, stdout: out.stdout, stderr: out.stderr });
        resolve(out);
      });
    });
  }
}
