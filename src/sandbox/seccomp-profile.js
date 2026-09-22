import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BPF_LD = 0x00;
const BPF_W = 0x00;
const BPF_ABS = 0x20;
const BPF_JMP = 0x05;
const BPF_JEQ = 0x10;
const BPF_K = 0x00;
const BPF_RET = 0x06;
const SECCOMP_RET_KILL_PROCESS = 0x80000000;
const SECCOMP_RET_ALLOW = 0x7fff0000;
const SECCOMP_RET_ERRNO = 0x00050000;
const EPERM = 1;

/** Audit arch + sethostname number. Only arches we can encode honestly. */
const ARCH = {
  x64: { audit: 0xc000003e, sethostname: 170 },
  arm64: { audit: 0xc00000b7, sethostname: 161 },
};

function insn(code, k, jt = 0, jf = 0) {
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(code, 0);
  buf.writeUInt8(jt, 2);
  buf.writeUInt8(jf, 3);
  buf.writeUInt32LE(k >>> 0, 4);
  return buf;
}

/**
 * Classic BPF sock_filter blob for bwrap --seccomp.
 * Allows the payload, returns EPERM for sethostname, kills a foreign audit arch.
 * This is a proof the filter is installed, not a full syscall allowlist.
 */
export function buildSeccompProgram(arch = process.arch) {
  const spec = ARCH[arch];
  if (!spec) throw new Error(`no seccomp profile for arch ${arch}`);
  const ld = BPF_LD | BPF_W | BPF_ABS;
  const jeq = BPF_JMP | BPF_JEQ | BPF_K;
  const ret = BPF_RET | BPF_K;
  return Buffer.concat([
    insn(ld, 4),
    insn(jeq, spec.audit, 0, 4),
    insn(ld, 0),
    insn(jeq, spec.sethostname, 0, 1),
    insn(ret, SECCOMP_RET_ERRNO | EPERM),
    insn(ret, SECCOMP_RET_ALLOW),
    insn(ret, SECCOMP_RET_KILL_PROCESS),
  ]);
}

export function openSeccompProfile(arch = process.arch) {
  const file = path.join(os.tmpdir(), `veor-seccomp-${process.pid}-${Date.now()}.bpf`);
  fs.writeFileSync(file, buildSeccompProgram(arch));
  const fd = fs.openSync(file, 'r');
  return {
    fd,
    file,
    cleanup() {
      try { fs.closeSync(fd); } catch { /* spawn already closed the parent fd */ }
      try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
    },
  };
}
