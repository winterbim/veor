import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { generateApprovalAuthority, signChallenge } from '../../src/security/approval-store.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function start({approvalKeys=null}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veor-gw-')); const out=path.join(dir,'out');fs.mkdirSync(out); const marker=path.join(dir,'marker');
 const policy=path.join(dir,'policy.json');fs.writeFileSync(policy,JSON.stringify({kind:'veor.policy/v1',filesystem:{readRoots:[root],writeRoots:[out]},mcp:{denyUnknownTools:true,tools:{'filesystem.read_file':{decision:'ALLOW',readPathArgs:['path']},'filesystem.write_file':{decision:'REVIEW',writePathArgs:['path'],requireExplicitWritePath:true}}}}));
 const env={...process.env,VEOR_POLICY:policy,VEOR_RUNTIME_DIR:path.join(dir,'rt'),VEOR_DOWNSTREAM_JSON:JSON.stringify([process.execPath,path.join(root,'examples/mcp/mock-server.js')]),VEOR_MOCK_MARKER:marker};
 if(approvalKeys){const pub=path.join(dir,'approval-public.pem');fs.writeFileSync(pub,approvalKeys.publicKeyPem);env.VEOR_APPROVAL_PUBLIC_KEY=pub;}
 const child=spawn(process.execPath,[path.join(root,'src/mcp/stdio.js')],{cwd:root,env,stdio:['pipe','pipe','pipe']});
 let seq=0;const pending=new Map();createInterface({input:child.stdout,crlfDelay:Infinity}).on('line',line=>{if(!line.trim())return;const m=JSON.parse(line);const p=pending.get(m.id);if(p){pending.delete(m.id);p(m)}});
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(new Error('timeout')),5000);pending.set(id,m=>{clearTimeout(timer);resolve(m)});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')});
 return {dir,out,marker,child,rpc};
}
async function init(c){await c.rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{}});await c.rpc('tools/list',{})}
function marks(c){return fs.existsSync(c.marker)?fs.readFileSync(c.marker,'utf8').trim().split(/\r?\n/).filter(Boolean):[]}

test('gateway passes safe read and blocks reviewed write before downstream',async t=>{const c=start();t.after(()=>c.child.kill());await init(c);const f=path.join(root,'README.md');let r=await c.rpc('tools/call',{name:'filesystem.read_file',arguments:{path:f}});assert.equal(r.result.isError,false);r=await c.rpc('tools/call',{name:'filesystem.write_file',arguments:{path:path.join(c.out,'x'),text:'x'}});assert.equal(r.result.isError,true);assert.equal(r.result.structuredContent.veor.decision,'REVIEW');assert.deepEqual(marks(c),['filesystem.read_file']);});

test('unknown tool is denied before downstream',async t=>{const c=start();t.after(()=>c.child.kill());await init(c);const r=await c.rpc('tools/call',{name:'surprise.delete_everything',arguments:{}});assert.equal(r.result.structuredContent.veor.decision,'DENY');assert.deepEqual(marks(c),[]);});


test('gateway consumes a signed REVIEW approval exactly once',async t=>{
 const keys=generateApprovalAuthority();const c=start({approvalKeys:keys});t.after(()=>c.child.kill());await init(c);const args={path:path.join(c.out,'approved.txt'),text:'x'};
 let r=await c.rpc('tools/call',{name:'filesystem.write_file',arguments:args});assert.equal(r.result.structuredContent.veor.decision,'REVIEW');const challengeInfo=r.result.structuredContent.veor.challenge;const challenge=JSON.parse(fs.readFileSync(challengeInfo.file,'utf8'));fs.writeFileSync(challenge.approvalFile,JSON.stringify(signChallenge(challenge,keys.privateKeyPem)));
 r=await c.rpc('tools/call',{name:'filesystem.write_file',arguments:args});assert.equal(r.result.isError,false);assert.deepEqual(marks(c),['filesystem.write_file']);
 r=await c.rpc('tools/call',{name:'filesystem.write_file',arguments:args});assert.equal(r.result.structuredContent.veor.decision,'REVIEW');assert.deepEqual(marks(c),['filesystem.write_file']);
});
