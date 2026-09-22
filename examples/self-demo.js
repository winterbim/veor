#!/usr/bin/env node
/**
 * VEOR-on-VEOR dogfood — drives the real gateway with policies/veor-self.json.
 * Emits ALLOW + DENY receipt artefacts and offline-verifies the ALLOW path
 * (plus a deliberate tamper failure).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { generateReceiptAuthority, ReceiptSigner } from '../src/security/receipt-signer.js';
import { verifyReceipt } from '../src/security/receipt-verify.js';
import { SecretBroker, scrubSecrets } from '../src/security/secret-broker.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-self-'));
const runtimeDir = path.join(work, 'runtime');
const marker = path.join(work, 'marker');
const secretSeenPath = path.join(work, 'secret-seen.json');
const secretFile = path.join(work, 'effect.secret');
const policyPath = path.join(root, 'policies', 'veor-self.json');
const evidenceDir = path.join(root, 'evidence', 'current');

fs.mkdirSync(evidenceDir, { recursive: true });

const receiptKeys = generateReceiptAuthority();
const receiptPrivate = path.join(work, 'receipt-private.pem');
const receiptPublic = path.join(work, 'receipt-public.pem');
fs.writeFileSync(receiptPrivate, receiptKeys.privateKeyPem, { mode: 0o600 });
fs.writeFileSync(receiptPublic, receiptKeys.publicKeyPem, { mode: 0o644 });

const broker = new SecretBroker();
const ephemeralSecret = broker.loadEphemeral('self-probe');
fs.writeFileSync(secretFile, ephemeralSecret, { mode: 0o600 });

const env = {
  ...process.env,
  VEOR_POLICY: policyPath,
  VEOR_RUNTIME_DIR: runtimeDir,
  VEOR_DOWNSTREAM_JSON: JSON.stringify([
    process.execPath,
    path.join(root, 'examples/mcp/self-server.js'),
  ]),
  VEOR_MOCK_MARKER: marker,
  VEOR_RECEIPT_PRIVATE_KEY: receiptPrivate,
  VEOR_EFFECT_SECRET_FILE: secretFile,
  VEOR_SECRET_SEEN_PATH: secretSeenPath,
};

const child = spawn(process.execPath, [path.join(root, 'src/mcp/stdio.js')], {
  cwd: root,
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const stderrChunks = [];
child.stderr.on('data', (c) => stderrChunks.push(c));

let seq = 0;
const pending = new Map();
createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const waiter = pending.get(message.id);
  if (waiter) {
    pending.delete(message.id);
    waiter(message);
  }
});

function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 10000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function section(title) {
  console.log(`\n## ${title}`);
}

function writeEvidence(name, value) {
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  return path.relative(root, file);
}

try {
  console.log('VEOR self-dogfood (live gateway on policies/veor-self.json)');
  console.log(`workDir=${work}`);
  console.log(`policy=${path.relative(root, policyPath)}`);

  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'veor-self', version: '0.4.0-dev.2' },
  });
  await rpc('tools/list', {});

  section('1) ALLOW — read CONSTITUTION.md through gateway');
  const allowed = await rpc('tools/call', {
    name: 'filesystem.read_file',
    arguments: { path: path.join(root, 'CONSTITUTION.md') },
  });
  const allowReceipt = allowed?.result?.veorReceipt ?? null;
  console.log(JSON.stringify({
    executed: allowReceipt?.body?.executed ?? null,
    decision: allowReceipt?.body?.decision ?? null,
    tool: allowReceipt?.body?.tool ?? null,
    signaturePresent: Boolean(allowReceipt?.signature),
    signatureValid: allowReceipt?.signature
      ? ReceiptSigner.verify(receiptKeys.publicKeyPem, allowReceipt)
      : null,
  }, null, 2));

  if (!allowReceipt?.signature) throw new Error('ALLOW path did not produce a signed receipt');
  if (allowReceipt.body?.decision !== 'ALLOW' || allowReceipt.body?.executed !== true) {
    throw new Error(`ALLOW path did not execute (decision=${allowReceipt.body?.decision}, executed=${allowReceipt.body?.executed})`);
  }
  const allowReceiptRel = writeEvidence('self-allow-receipt.json', allowReceipt);
  const allowPubRel = writeEvidence('self-allow-receipt.pub.pem', receiptKeys.publicKeyPem);

  section('2) DENY — destructive veor.self.delete blocked before downstream');
  const denied = await rpc('tools/call', {
    name: 'veor.self.delete',
    arguments: { path: path.join(root, 'CONSTITUTION.md') },
  });
  const denyReceipt = denied?.result?.veorReceipt
    ?? denied?.result?.structuredContent?.veor?.receipt
    ?? null;
  console.log(JSON.stringify({
    decision: denied?.result?.structuredContent?.veor?.decision ?? null,
    executed: denied?.result?.structuredContent?.veor?.executed ?? false,
    reasons: denied?.result?.structuredContent?.veor?.reasons ?? null,
    signaturePresent: Boolean(denyReceipt?.signature),
    signatureValid: denyReceipt?.signature
      ? ReceiptSigner.verify(receiptKeys.publicKeyPem, denyReceipt)
      : null,
  }, null, 2));
  if (!denyReceipt?.signature) throw new Error('DENY path did not produce a signed receipt');
  const denyReceiptRel = writeEvidence('self-deny-receipt.json', denyReceipt);
  writeEvidence('self-deny-receipt.pub.pem', receiptKeys.publicKeyPem);

  section('3) ALLOW — secret_probe via broker-injected one-shot file');
  const probed = await rpc('tools/call', {
    name: 'veor.self.secret_probe',
    arguments: {},
  });
  const probeReceipt = probed?.result?.veorReceipt ?? null;
  const seen = fs.existsSync(secretSeenPath)
    ? JSON.parse(fs.readFileSync(secretSeenPath, 'utf8'))
    : null;
  // Effect saw the secret (side channel proof); receipt must not contain it.
  const receiptBlob = JSON.stringify(probeReceipt);
  const logsBlob = scrubSecrets(Buffer.concat(stderrChunks).toString('utf8'), [ephemeralSecret]);
  console.log(JSON.stringify({
    effectSawSecret: Boolean(seen?.sawSecret),
    secretLengthMatched: seen?.secretLength === ephemeralSecret.length,
    receiptContainsSecret: receiptBlob.includes(ephemeralSecret),
    stderrContainsSecret: Buffer.concat(stderrChunks).toString('utf8').includes(ephemeralSecret),
    signatureValid: probeReceipt?.signature
      ? ReceiptSigner.verify(receiptKeys.publicKeyPem, probeReceipt)
      : null,
  }, null, 2));
  if (!seen?.sawSecret) throw new Error('secret_probe effect did not see the broker secret');
  if (receiptBlob.includes(ephemeralSecret)) throw new Error('receipt leaked the secret');
  if (Buffer.concat(stderrChunks).toString('utf8').includes(ephemeralSecret)) {
    throw new Error('gateway stderr leaked the secret');
  }
  broker.clear('self-probe');
  try { fs.rmSync(secretFile, { force: true }); } catch { /* ignore */ }
  if (probeReceipt?.signature) {
    writeEvidence('self-secret-receipt.json', probeReceipt);
  }

  section('4) Offline verify — ALLOW receipt replays; tamper fails');
  const verifyOk = verifyReceipt(allowReceipt, receiptKeys.publicKeyPem);
  const tampered = structuredClone(allowReceipt);
  tampered.body.executed = false;
  tampered.body.tool = 'tampered.tool';
  // Keep old digest so verify detects DIGEST_MISMATCH (and signature over new body fails).
  const verifyBad = verifyReceipt(tampered, receiptKeys.publicKeyPem);
  const cli = spawnSync(process.execPath, [
    path.join(root, 'src/cli.js'),
    'verify', 'receipt',
    path.join(evidenceDir, 'self-allow-receipt.json'),
    '--public', path.join(evidenceDir, 'self-allow-receipt.pub.pem'),
  ], { encoding: 'utf8', cwd: root });
  console.log(JSON.stringify({
    verifyAllow: verifyOk,
    verifyTampered: verifyBad,
    cliExitCode: cli.status,
    cliStdout: cli.stdout ? JSON.parse(cli.stdout) : null,
  }, null, 2));
  if (!verifyOk.ok) throw new Error('ALLOW receipt failed offline verify');
  if (verifyBad.ok) throw new Error('tampered receipt incorrectly verified');
  if (cli.status !== 0) throw new Error('veor verify CLI failed on self-allow receipt');

  section('5) Downstream marker (DENY must not appear)');
  const marks = fs.existsSync(marker)
    ? fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/).filter(Boolean)
    : [];
  console.log(JSON.stringify({
    downstreamCallsObserved: marks,
    denyBlockedBeforeDownstream: !marks.includes('veor.self.delete'),
    artefacts: {
      allowReceipt: allowReceiptRel,
      allowPublicKey: allowPubRel,
      denyReceipt: denyReceiptRel,
    },
  }, null, 2));
  if (marks.includes('veor.self.delete')) {
    throw new Error('DENY tool reached downstream');
  }

  console.log('\nSelf-dogfood complete. Gateway governed VEOR against its own policy.');
  // Keep scrub reference used (lint-friendly intentional use).
  void logsBlob;
} finally {
  broker.clearAll();
  try { child.stdin.end(); } catch { /* ignore */ }
  try { if (!child.killed) child.kill('SIGTERM'); } catch { /* ignore */ }
  try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
}
