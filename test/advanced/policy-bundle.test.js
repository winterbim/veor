import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PolicyBundle } from '../../src/policy-bundle.js';

test('unknown MCP tools fail closed',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'veor-policy-'));
 const p=new PolicyBundle({kind:'veor.policy/v1',filesystem:{readRoots:['.'],writeRoots:['out']},mcp:{denyUnknownTools:true,tools:{}}},{baseDir:base});
 const r=p.evaluateTool({tool:{name:'surprise',annotations:{readOnlyHint:true}},args:{}}); assert.equal(r.decision,'DENY');
});

test('write paths are bounded and explicit',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'veor-policy-')); fs.mkdirSync(path.join(base,'out'));
 const p=new PolicyBundle({kind:'veor.policy/v1',filesystem:{readRoots:['.'],writeRoots:['out']},mcp:{tools:{w:{decision:'REVIEW',writePathArgs:['path'],requireExplicitWritePath:true}}}},{baseDir:base});
 assert.equal(p.evaluateTool({tool:{name:'w',annotations:{readOnlyHint:false}},args:{}}).decision,'DENY');
 assert.equal(p.evaluateTool({tool:{name:'w',annotations:{readOnlyHint:false}},args:{path:path.join(base,'out','ok.txt')}}).decision,'REVIEW');
 assert.equal(p.evaluateTool({tool:{name:'w',annotations:{readOnlyHint:false}},args:{path:path.join(os.tmpdir(),'escape.txt')}}).decision,'DENY');
});

test('advisory ALLOW cannot weaken deterministic REVIEW',()=>{
 const p=new PolicyBundle({kind:'veor.policy/v1',mcp:{tools:{w:{decision:'REVIEW'}}}});
 assert.equal(p.evaluateTool({tool:{name:'w',annotations:{readOnlyHint:false}},args:{},advisoryDecision:'ALLOW'}).decision,'REVIEW');
});
