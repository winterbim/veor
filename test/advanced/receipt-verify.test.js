import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateReceiptAuthority, ReceiptSigner } from '../../src/security/receipt-signer.js';
import { verifyReceipt, verifyLedgerDir } from '../../src/security/receipt-verify.js';
import { PersistentLedger } from '../../src/security/persistent-ledger.js';

test('offline verify accepts a valid signed receipt', () => {
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const signed = signer.sign({ tool: 'filesystem.read_file', executed: true, resultDigest: 'abc', decision: 'ALLOW' });
  const out = verifyReceipt(signed, keys.publicKeyPem);
  assert.equal(out.ok, true);
  assert.equal(out.checks.digest, true);
  assert.equal(out.checks.signature, true);
  assert.equal(out.checks.ledger, null);
});

test('offline verify rejects tampered body', () => {
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const signed = signer.sign({ tool: 'x', executed: true, resultDigest: 'abc' });
  signed.body.executed = false;
  const out = verifyReceipt(signed, keys.publicKeyPem);
  assert.equal(out.ok, false);
  assert.ok(out.reasons.includes('BAD_SIGNATURE') || out.reasons.includes('DIGEST_MISMATCH'));
});

test('offline verify rejects wrong public key', () => {
  const a = generateReceiptAuthority();
  const b = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: a.privateKeyPem });
  const signed = signer.sign({ tool: 'x', executed: true, resultDigest: 'abc' });
  const out = verifyReceipt(signed, b.publicKeyPem);
  assert.equal(out.ok, false);
  assert.ok(out.reasons.includes('BAD_SIGNATURE'));
});

test('offline verify rejects digest mismatch without re-signing', () => {
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const signed = signer.sign({ tool: 'x', executed: true, resultDigest: 'abc' });
  signed.digest = '0'.repeat(64);
  const out = verifyReceipt(signed, keys.publicKeyPem);
  assert.equal(out.ok, false);
  assert.ok(out.reasons.includes('DIGEST_MISMATCH'));
});

test('offline verify can bind receipt into a valid ledger chain', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-rv-'));
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const signed = signer.sign({ tool: 'x', executed: true, resultDigest: 'abc' });
  const ledger = new PersistentLedger({ dir });
  ledger.append('decision', { tool: 'x', decision: 'ALLOW' });
  ledger.append('receipt', signed);
  const out = verifyReceipt(signed, keys.publicKeyPem, { ledgerDir: dir });
  assert.equal(out.ok, true);
  assert.equal(out.checks.ledger, true);
  assert.equal(verifyLedgerDir(dir).ok, true);
});

test('receipt verify is re-playable (not one-shot); approvals remain one-shot elsewhere', () => {
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const signed = signer.sign({ tool: 'x', executed: true, resultDigest: 'abc' });
  assert.equal(verifyReceipt(signed, keys.publicKeyPem).ok, true);
  assert.equal(verifyReceipt(signed, keys.publicKeyPem).ok, true);
});
