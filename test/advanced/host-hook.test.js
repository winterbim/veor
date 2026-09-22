import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateRepoEffect, toHookResponse } from '../../src/host/repo-effect-gate.js';
import { generateReceiptAuthority, ReceiptSigner } from '../../src/security/receipt-signer.js';
import { hashObject } from '../../src/canonical.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hookPath = path.join(root, '.cursor/hooks/veor-repo-effect.js');

test('repo effect gate denies missing receipt and accepts a valid signed receipt', () => {
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const args = { path: 'CONSTITUTION.md' };
  const receipt = signer.sign({
    tool: 'filesystem.read_file',
    decision: 'ALLOW',
    executed: true,
    argsDigest: hashObject(args),
    resultDigest: 'abc',
  });

  const denied = gateRepoEffect({ receipt: null, publicKeyPem: keys.publicKeyPem, tool: 'filesystem.read_file' });
  assert.equal(denied.ok, false);
  assert.ok(denied.reasons.includes('MISSING_VEOR_RECEIPT'));
  assert.equal(toHookResponse(denied).permission, 'deny');

  const allowed = gateRepoEffect({
    receipt,
    publicKeyPem: keys.publicKeyPem,
    tool: 'filesystem.read_file',
    args,
  });
  assert.equal(allowed.ok, true);
  assert.equal(toHookResponse(allowed).permission, 'allow');
});

test('Cursor host hook denies an ordinary shell command without a receipt', () => {
  const input = JSON.stringify({ command: 'rm -rf /' });
  const run = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input,
    encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  const out = JSON.parse(run.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(out.permission, 'deny');
});

test('Cursor host hook allows a maintenance command and rejects a chained one', () => {
  const allowed = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input: JSON.stringify({ command: 'npm run check' }),
    encoding: 'utf8',
  });
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(JSON.parse(allowed.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)).permission, 'allow');

  const chained = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input: JSON.stringify({ command: 'npm run check && rm -rf /' }),
    encoding: 'utf8',
  });
  assert.equal(chained.status, 2);
  assert.equal(JSON.parse(chained.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)).permission, 'deny');
});

test('Cursor host hook script denies gated shell without receipt (CI-executed)', () => {
  const input = JSON.stringify({
    command: 'node scripts/veor-gated-effect.js --tool filesystem.read_file -- -- echo hi',
  });
  const run = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: { ...process.env, VEOR_REQUIRE_RECEIPT: '1' },
  });
  assert.equal(run.status, 2);
  const out = JSON.parse(run.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(out.permission, 'deny');
});

test('Cursor host hook allows gated shell when valid receipt env is present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-hook-'));
  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const receipt = signer.sign({
    tool: 'filesystem.read_file',
    decision: 'ALLOW',
    executed: true,
    resultDigest: 'abc',
  });
  const receiptFile = path.join(dir, 'receipt.json');
  const pubFile = path.join(dir, 'pub.pem');
  fs.writeFileSync(receiptFile, JSON.stringify(receipt));
  fs.writeFileSync(pubFile, keys.publicKeyPem);

  const input = JSON.stringify({
    command: 'veor-gated echo hi',
    tool_name: 'filesystem.read_file',
  });
  const run = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      VEOR_EFFECT_RECEIPT: receiptFile,
      VEOR_EFFECT_RECEIPT_PUB: pubFile,
      VEOR_EFFECT_TOOL: 'filesystem.read_file',
    },
  });
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
  assert.equal(out.permission, 'allow');
});
