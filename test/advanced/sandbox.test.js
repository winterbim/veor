import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSandbox, detectSandboxBackends, BubblewrapSandbox, ProcessSandbox } from '../../src/sandbox/index.js';

test('sandbox detection reports a concrete strongest backend',()=>{ const d=detectSandboxBackends(); assert.ok(['bubblewrap','podman','docker','process'].includes(d.strongestLocal)); });

test('process fallback clearly reports no OS isolation',()=>{ const s=createSandbox({backend:'process'}); assert.equal(s.describe().osEnforced,false); });

test('requireOsIsolation refuses unsafe fallback',()=>{ assert.throws(()=>createSandbox({backend:'process',requireOsIsolation:true}),/OS isolation required/); });

test('ProcessSandbox constructor refuses requireOsIsolation (honest osEnforced:false guard)',()=>{
  assert.throws(()=>new ProcessSandbox({requireOsIsolation:true}),/process backend cannot enforce/);
});

test('bubblewrap plan denies network and binds workspace when available conceptually',()=>{ const w=fs.mkdtempSync(path.join(os.tmpdir(),'veor-sb-')); const s=new BubblewrapSandbox({workspace:w,readRoots:[w],writeRoots:[w],network:'deny'}); const argv=s.buildArgv(['node','-v']); assert.ok(argv.includes('--unshare-net')); assert.ok(argv.includes('--bind')); assert.equal(argv[0],'bwrap'); });
