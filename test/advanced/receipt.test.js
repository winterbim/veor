import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReceiptAuthority, ReceiptSigner } from '../../src/security/receipt-signer.js';

test('execution receipt signature verifies and detects tampering',()=>{
  const keys=generateReceiptAuthority(); const signer=new ReceiptSigner({privateKeyPem:keys.privateKeyPem});
  const signed=signer.sign({tool:'x',executed:true,resultDigest:'abc'});
  assert.equal(ReceiptSigner.verify(keys.publicKeyPem,signed),true);
  signed.body.executed=false;
  assert.equal(ReceiptSigner.verify(keys.publicKeyPem,signed),false);
});
