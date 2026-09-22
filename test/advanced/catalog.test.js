import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CatalogGuard } from '../../src/mcp/catalog-guard.js';

test('catalog guard baselines then detects tool drift',()=>{ const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'veor-cat-')),'cat'); const g=new CatalogGuard({file}); const a=[{name:'a',inputSchema:{type:'object'}}]; assert.equal(g.check(a).changed,false); assert.equal(g.check([...a,{name:'b'}]).changed,true); });
