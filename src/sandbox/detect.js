import { spawnSync } from 'node:child_process';

function has(command) {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 1500 });
  return !probe.error && probe.status === 0;
}

export function detectSandboxBackends() {
  const linux = process.platform === 'linux';
  const bwrap = linux && has('bwrap');
  const docker = has('docker');
  const podman = has('podman');
  return {
    platform: process.platform,
    bwrap,
    docker,
    podman,
    strongestLocal: bwrap ? 'bubblewrap' : (podman ? 'podman' : (docker ? 'docker' : 'process')),
  };
}
