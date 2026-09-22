import fs from 'node:fs';
import path from 'node:path';
import { ProcessSandbox } from './process-sandbox.js';

function bindIfExists(args, source, dest = source) { if (fs.existsSync(source)) args.push('--ro-bind', source, dest); }

export class BubblewrapSandbox extends ProcessSandbox {
  constructor({ workspace, readRoots = [], writeRoots = [], network = 'deny', requireOsIsolation: _requireOs = false, ...rest } = {}) {
    // Bubblewrap is an OS-isolation backend; do not let ProcessSandbox reject requireOsIsolation.
    super({ cwd: workspace, ...rest });
    this.workspace = path.resolve(workspace ?? process.cwd());
    this.readRoots = readRoots.map(p => path.resolve(p));
    this.writeRoots = writeRoots.map(p => path.resolve(p));
    this.network = network;
  }
  describe() {
    // Capability intent only. Per-exec results set osEnforced after bwrap actually starts.
    return { backend:'bubblewrap', isolation:'namespace', osEnforced:false, networkIsolated:this.network !== 'allow', filesystemIsolated:true, noNewPrivileges:true, note:'osEnforced becomes true only after a successful bubblewrap spawn' };
  }
  buildArgv(argv, { cwd = this.workspace } = {}) {
    const b = ['bwrap','--die-with-parent','--new-session','--unshare-user','--unshare-pid','--unshare-ipc','--unshare-uts','--unshare-cgroup-try','--proc','/proc','--dev','/dev','--tmpfs','/tmp'];
    if (this.network !== 'allow') b.push('--unshare-net');
    for (const sys of ['/usr','/bin','/sbin','/lib','/lib64','/etc']) bindIfExists(b, sys);
    const allRead = new Set([this.workspace, ...this.readRoots]);
    for (const root of allRead) if (fs.existsSync(root)) b.push('--ro-bind', root, root);
    for (const root of this.writeRoots) { fs.mkdirSync(root,{recursive:true}); b.push('--bind', root, root); }
    const rcwd = path.resolve(cwd);
    b.push('--chdir', rcwd, '--', ...argv);
    return b;
  }
  async exec(argv, options = {}) {
    const result = await super.exec(this.buildArgv(argv, options), { ...options, cwd: '/' });
    // Honest: isolation counts only after bubblewrap is running the payload.
    // A setup failure (for example loopback RTM_NEWADDR on locked-down CI kernels)
    // is bwrap itself, not an in-namespace exit, and must not set osEnforced.
    // A non-zero exit of the payload, with no bwrap setup error, still means isolation ran.
    const setupFailed = result.code === 'SPAWN_ERROR'
      || (result.code !== 0 && /(^|\n)bwrap: /.test(result.stderr ?? ''));
    const started = !setupFailed;
    result.sandbox = {
      backend: 'bubblewrap',
      isolation: started ? 'namespace' : 'none',
      osEnforced: started,
      networkIsolated: started && this.network !== 'allow',
      filesystemIsolated: started,
      noNewPrivileges: started,
      ...(started ? {} : { note: 'bubblewrap failed to start; not claiming OS isolation' }),
    };
    return result;
  }
}
