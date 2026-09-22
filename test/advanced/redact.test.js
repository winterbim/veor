import test from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../../src/security/redact.js';

test('approval previews redact common secret fields',()=>{
 const r=redact({token:'abc',nested:{password:'pw',name:'ok'},authorization:'Bearer x'});
 assert.equal(r.token,'[REDACTED]');assert.equal(r.nested.password,'[REDACTED]');assert.equal(r.nested.name,'ok');assert.equal(r.authorization,'[REDACTED]');
});
