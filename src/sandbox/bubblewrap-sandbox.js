import fs from 'node:fs';
import path from 'node:path';
import { ProcessSandbox } from './process-sandbox.js';

function bindIfExists(args, source, dest = source) { if (fs.existsSync(source)) args.push('--ro-bind', source, dest); }

export class BubblewrapSandbox extends ProcessSandbox {
  constructor({ workspace, readRoots = [], writeRoots = [], network = 'deny', ...rest } = {}) {
    super({ cwd: workspace, ...rest });
    this.workspace = path.resolve(workspace ?? process.cwd());
    this.readRoots = readRoots.map(p => path.resolve(p));
    this.writeRoots = writeRoots.map(p => path.resolve(p));
    this.network = network;
  }
  describe() {
    return { backend:'bubblewrap', isolation:'namespace', osEnforced:true, networkIsolated:this.network !== 'allow', filesystemIsolated:true, noNewPrivileges:true };
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
  async exec(argv, options = {}) { return super.exec(this.buildArgv(argv, options), { ...options, cwd: '/' }); }
}
