import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApprovalStore, generateApprovalAuthority, signChallenge } from '../../src/security/approval-store.js';

test('one-shot approval is proposal-bound and replay resistant',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veor-approval-'));
  const keys=generateApprovalAuthority();
  const store=new ApprovalStore({dir,publicKeyPem:keys.publicKeyPem,ttlMs:60_000});
  const c=store.create({tool:'x.write',args:{path:'a'},reasons:['REVIEW']});
  fs.writeFileSync(c.approvalFile,JSON.stringify(signChallenge(c,keys.privateKeyPem)));
  assert.equal(store.verifyAndConsume(c).ok,true);
  assert.equal(store.verifyAndConsume(c).ok,false);
});

test('approval signature cannot be reused for altered args',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veor-approval-'));
  const keys=generateApprovalAuthority(); const store=new ApprovalStore({dir,publicKeyPem:keys.publicKeyPem});
  const c=store.create({tool:'x.write',args:{path:'a'}}); const signed=signChallenge(c,keys.privateKeyPem);
  const altered=store.create({tool:'x.write',args:{path:'b'}}); fs.writeFileSync(altered.approvalFile,JSON.stringify(signed));
  assert.equal(store.verifyAndConsume(altered).ok,false);
});
