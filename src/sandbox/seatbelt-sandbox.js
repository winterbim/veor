import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProcessSandbox } from './process-sandbox.js';

function schemePath(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * macOS Seatbelt via sandbox-exec.
 * osEnforced is true only after sandbox-exec starts the payload.
 */
export class SeatbeltSandbox extends ProcessSandbox {
  constructor({ workspace, readRoots = [], writeRoots = [], network = 'deny', requireOsIsolation: _requireOs = false, ...rest } = {}) {
    super({ cwd: workspace, ...rest });
    this.workspace = path.resolve(workspace ?? process.cwd());
    this.readRoots = readRoots.map((entry) => path.resolve(entry));
    this.writeRoots = writeRoots.map((entry) => path.resolve(entry));
    this.network = network;
  }

  describe() {
    return {
      backend: 'seatbelt',
      isolation: 'macos-seatbelt',
      osEnforced: false,
      networkIsolated: this.network !== 'allow',
      filesystemIsolated: true,
      platform: 'darwin',
      note: 'osEnforced becomes true only after sandbox-exec starts the payload',
    };
  }

  buildProfile() {
    const writes = this.writeRoots.length ? this.writeRoots : [this.workspace];
    const allowWrites = writes.map((entry) => `(allow file-write* (subpath ${schemePath(entry)}))`).join('\n');
    const networkRule = this.network === 'allow' ? '(allow network*)' : '(deny network*)';
    return `(version 1)
(deny default)
(allow process*)
(allow signal)
(allow sysctl-read)
(allow mach*)
(allow ipc-posix*)
(allow system-fcntl)
(allow file-ioctl)
(allow file-map-executable)
(allow file-read*)
${allowWrites}
${networkRule}
`;
  }

  async exec(argv, options = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-seatbelt-'));
    const profile = path.join(dir, 'profile.sb');
    fs.writeFileSync(profile, this.buildProfile());
    let result;
    try {
      result = await super.exec(['sandbox-exec', '-f', profile, '--', ...argv], { ...options, cwd: options.cwd ?? this.workspace });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const setupFailed = result.code === 'SPAWN_ERROR'
      || (result.code !== 0 && /sandbox-exec:/.test(result.stderr ?? '') && !(result.stdout ?? '').trim());
    const started = !setupFailed;
    result.sandbox = {
      backend: 'seatbelt',
      isolation: started ? 'macos-seatbelt' : 'none',
      osEnforced: started,
      networkIsolated: started && this.network !== 'allow',
      filesystemIsolated: started,
      platform: 'darwin',
      ...(started ? {} : { note: 'sandbox-exec failed to start; not claiming OS isolation' }),
    };
    return result;
  }
}
