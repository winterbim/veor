import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSandbox, detectSandboxBackends, BubblewrapSandbox } from '../../src/sandbox/index.js';
import { landlockHelperPath } from '../../src/sandbox/landlock.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function compileProbe(source, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-probe-'));
  const cfile = path.join(dir, `${name}.c`);
  const bin = path.join(dir, name);
  fs.writeFileSync(cfile, source);
  const built = spawnSync('gcc', ['-O2', '-o', bin, cfile], { encoding: 'utf8' });
  if (built.status !== 0) return null;
  return bin;
}

test('seccomp filter blocks sethostname inside bubblewrap and reports seccomp only when applied', async () => {
  const detected = detectSandboxBackends();
  if (!detected.bwrap || (process.arch !== 'x64' && process.arch !== 'arm64')) return;
  const probe = compileProbe(`
    #include <stdio.h>
    #include <errno.h>
    #include <unistd.h>
    int main(void) {
      if (sethostname("veor-sbx", 8) == 0) { puts("host-ok"); return 0; }
      printf("host-fail %d\\n", errno);
      return 2;
    }
  `, 'hostprobe');
  if (!probe) return;
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-seccomp-'));
  const sandbox = new BubblewrapSandbox({ workspace: w, readRoots: [w], writeRoots: [w], network: 'allow' });
  const open = await sandbox.exec([probe], { seccomp: false });
  if (!open.ok || !open.stdout.includes('host-ok')) {
    assert.equal(open.sandbox.seccomp, false);
    return;
  }
  const closed = await sandbox.exec([probe]);
  assert.equal(closed.sandbox.seccomp, true);
  assert.equal(closed.sandbox.osEnforced, true);
  assert.match(closed.stdout, /host-fail 1/);
});

test('landlock helper allows writes inside the granted directory only', () => {
  const helper = landlockHelperPath();
  if (!helper) return;
  const granted = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-ll-in-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-ll-out-'));
  const writeIn = path.join(granted, 'ok.txt');
  const writeOut = path.join(outside, 'no.txt');
  const allow = spawnSync(helper, ['--rw', granted, '--', process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(writeIn)}, 'x')`], { encoding: 'utf8' });
  assert.equal(allow.status, 0, allow.stderr);
  assert.equal(fs.readFileSync(writeIn, 'utf8'), 'x');
  const deny = spawnSync(helper, ['--rw', granted, '--', process.execPath, '-e', `try{require('fs').writeFileSync(${JSON.stringify(writeOut)}, 'x')}catch(e){process.stderr.write(e.code||''); process.exit(7)}`], { encoding: 'utf8' });
  assert.equal(deny.status, 7, deny.stderr);
  assert.equal(fs.existsSync(writeOut), false);
  const info = createSandbox({ backend: 'process' }).describe();
  assert.equal(info.osEnforced, false);
});
