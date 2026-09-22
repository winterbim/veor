import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AsyncFileLedgerAdapter, FileEvidenceLedger } from '../src/file-ledger.js';

test('file ledger persists events and anchored head', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'veor-ledger-'));
  const store = new FileEvidenceLedger({ file: path.join(root, 'ledger.jsonl') });
  await store.load();
  const ledger = new AsyncFileLedgerAdapter(store);
  ledger.append('one', { ok: 1 }, '2026-09-22T00:00:00.000Z');
  ledger.append('two', { ok: 2 }, '2026-09-22T00:00:01.000Z');
  await ledger.flush();
  const verify = await store.verifyPersistedHead();
  assert.deepEqual({ valid: verify.valid, length: verify.length }, { valid: true, length: 2 });
  const lines = (await readFile(store.file, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
});

test('file ledger external head detects tail truncation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'veor-ledger-'));
  const store = new FileEvidenceLedger({ file: path.join(root, 'ledger.jsonl') });
  await store.load();
  const ledger = new AsyncFileLedgerAdapter(store);
  ledger.append('one', { ok: 1 }, '2026-09-22T00:00:00.000Z');
  ledger.append('two', { ok: 2 }, '2026-09-22T00:00:01.000Z');
  await ledger.flush();
  const lines = (await readFile(store.file, 'utf8')).trim().split('\n');
  await writeFile(store.file, `${lines[0]}\n`, 'utf8');
  const reloaded = new FileEvidenceLedger({ file: store.file, headFile: store.headFile });
  await reloaded.load();
  const verify = await reloaded.verifyPersistedHead();
  assert.equal(verify.valid, false);
  assert.equal(verify.reason, 'HEAD_MISMATCH');
});
