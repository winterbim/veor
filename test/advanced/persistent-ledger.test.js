import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PersistentLedger } from '../../src/security/persistent-ledger.js';

test('persistent ledger detects tail truncation via external head',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veor-ledger-')); const l=new PersistentLedger({dir}); l.append('a',{x:1}); l.append('b',{x:2}); assert.equal(l.verify().valid,true);
 const lines=fs.readFileSync(l.file,'utf8').trim().split('\n'); fs.writeFileSync(l.file,lines[0]+'\n'); assert.equal(l.verify().valid,false); assert.equal(l.verify().reason,'HEAD_MISMATCH');
});
