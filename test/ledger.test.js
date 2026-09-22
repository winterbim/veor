import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceLedger } from '../src/index.js';

test('evidence ledger verifies an intact chain', () => {
  const ledger = new EvidenceLedger();
  ledger.append('proposal', { a: 1 }, '2026-09-22T08:00:00.000Z');
  ledger.append('policy', { decision: 'ALLOW' }, '2026-09-22T08:00:01.000Z');
  assert.deepEqual(ledger.verifyChain().valid, true);
});

test('mutating a retained event breaks chain verification', () => {
  const ledger = new EvidenceLedger();
  ledger.append('proposal', { a: 1 }, '2026-09-22T08:00:00.000Z');
  ledger.append('policy', { decision: 'ALLOW' }, '2026-09-22T08:00:01.000Z');
  ledger.events[0].payload.a = 999;
  const result = ledger.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'EVENT_HASH_MISMATCH');
});

test('deleting a middle event breaks the previous-hash linkage', () => {
  const ledger = new EvidenceLedger();
  ledger.append('proposal', { a: 1 }, '2026-09-22T08:00:00.000Z');
  ledger.append('policy', { decision: 'ALLOW' }, '2026-09-22T08:00:01.000Z');
  ledger.append('effect', { ok: true }, '2026-09-22T08:00:02.000Z');
  ledger.events.splice(1, 1);
  const result = ledger.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'PREVIOUS_HASH_MISMATCH');
});

test('a trusted external head detects tail truncation', () => {
  const ledger = new EvidenceLedger();
  ledger.append('proposal', { a: 1 }, '2026-09-22T08:00:00.000Z');
  ledger.append('policy', { decision: 'ALLOW' }, '2026-09-22T08:00:01.000Z');
  const trustedHead = ledger.verifyChain().head;
  ledger.events.pop();
  const result = ledger.verifyChain(trustedHead);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'HEAD_MISMATCH');
});
