import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function commandOnPath(command) {
  if (process.platform === 'win32') {
    const probe = spawnSync('where.exe', [command], { stdio: 'ignore', windowsHide: true });
    return !probe.error && probe.status === 0;
  }
  const probe = spawnSync('which', [command], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

export function detectSandboxBackends() {
  const platform = process.platform;
  const bwrap = platform === 'linux' && commandOnPath('bwrap');
  const seatbelt = platform === 'darwin' && (fs.existsSync('/usr/bin/sandbox-exec') || commandOnPath('sandbox-exec'));
  const docker = commandOnPath('docker');
  const podman = commandOnPath('podman');
  let strongestLocal = 'process';
  if (bwrap) strongestLocal = 'bubblewrap';
  else if (seatbelt) strongestLocal = 'seatbelt';
  return {
    platform,
    bwrap,
    seatbelt,
    docker,
    podman,
    // docker and podman are detected but not selected: no backend claims their isolation yet.
    strongestLocal,
  };
}
