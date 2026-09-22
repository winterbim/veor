#!/usr/bin/env node
/**
 * Real boundary demo — drives the shipped MCP gateway (src/mcp/stdio.js)
 * against the included downstream mock server. Not a simulated transcript:
 * decisions, blocks, and receipts come from the live process.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { generateReceiptAuthority, ReceiptSigner } from '../src/security/receipt-signer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-boundary-demo-'));
const outDir = path.join(work, 'out');
const runtimeDir = path.join(work, 'runtime');
const marker = path.join(work, 'marker');
fs.mkdirSync(outDir);

const policyPath = path.join(work, 'policy.json');
fs.writeFileSync(policyPath, JSON.stringify({
  kind: 'veor.policy/v1',
  filesystem: { readRoots: [root], writeRoots: [outDir] },
  mcp: {
    denyUnknownTools: true,
    tools: {
      'filesystem.read_file': { decision: 'ALLOW', readPathArgs: ['path'] },
      'filesystem.write_file': {
        decision: 'REVIEW',
        writePathArgs: ['path'],
        requireExplicitWritePath: true,
      },
    },
  },
  sandbox: { backend: 'auto', network: 'deny', requireOsIsolation: false },
}, null, 2));

const receiptKeys = generateReceiptAuthority();
const receiptPrivate = path.join(work, 'receipt-private.pem');
const receiptPublic = path.join(work, 'receipt-public.pem');
fs.writeFileSync(receiptPrivate, receiptKeys.privateKeyPem, { mode: 0o600 });
fs.writeFileSync(receiptPublic, receiptKeys.publicKeyPem, { mode: 0o644 });

const env = {
  ...process.env,
  VEOR_POLICY: policyPath,
  VEOR_RUNTIME_DIR: runtimeDir,
  VEOR_DOWNSTREAM_JSON: JSON.stringify([
    process.execPath,
    path.join(root, 'examples/mcp/mock-server.js'),
  ]),
  VEOR_MOCK_MARKER: marker,
  VEOR_RECEIPT_PRIVATE_KEY: receiptPrivate,
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
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 8000);
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

function showDecision(label, response) {
  const veor = response?.result?.structuredContent?.veor
    ?? response?.result?.structuredContent
    ?? null;
  const receipt = response?.result?.veorReceipt ?? null;
  console.log(`\n### ${label}`);
  console.log(JSON.stringify({
    isError: response?.result?.isError ?? null,
    decision: veor?.decision ?? null,
    executed: veor?.executed ?? (receipt?.body?.executed ?? null),
    reasons: veor?.reasons ?? null,
    receipt: receipt ? {
      digest: receipt.digest,
      signaturePresent: Boolean(receipt.signature),
      signaturePrefix: receipt.signature ? String(receipt.signature).slice(0, 24) + '…' : null,
      body: {
        tool: receipt.body?.tool,
        decision: receipt.body?.decision,
        executed: receipt.body?.executed,
        resultDigest: receipt.body?.resultDigest,
        policyDigest: receipt.body?.policyDigest
          ? String(receipt.body.policyDigest).slice(0, 16) + '…'
          : null,
      },
      signatureValid: receipt.signature
        ? ReceiptSigner.verify(receiptKeys.publicKeyPem, receipt)
        : null,
    } : null,
    text: Array.isArray(response?.result?.content)
      ? response.result.content.map((c) => c.text).join('\n')
      : null,
  }, null, 2));
}

function markerLines() {
  if (!fs.existsSync(marker)) return [];
  return fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/).filter(Boolean);
}

try {
  console.log('VEOR boundary demo (live gateway)');
  console.log(`workDir=${work}`);
  console.log(`gateway=src/mcp/stdio.js`);
  console.log(`downstream=examples/mcp/mock-server.js`);

  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'veor-boundary-demo', version: '0.4.0-dev.1' },
  });
  await rpc('tools/list', {});

  section('1) Unknown tool — deterministic DENY before downstream');
  const denied = await rpc('tools/call', {
    name: 'surprise.delete_everything',
    arguments: {},
  });
  showDecision('surprise.delete_everything', denied);

  section('2) Policy REVIEW — write blocked before downstream');
  const reviewed = await rpc('tools/call', {
    name: 'filesystem.write_file',
    arguments: {
      path: path.join(outDir, 'should-not-exist.txt'),
      text: 'blocked',
    },
  });
  showDecision('filesystem.write_file', reviewed);

  section('3) Policy ALLOW — read executes; signed receipt produced');
  const allowed = await rpc('tools/call', {
    name: 'filesystem.read_file',
    arguments: { path: path.join(root, 'README.md') },
  });
  showDecision('filesystem.read_file', allowed);

  section('4) Downstream effect marker (what actually ran)');
  console.log(JSON.stringify({
    downstreamCallsObserved: markerLines(),
    writeFileCreated: fs.existsSync(path.join(outDir, 'should-not-exist.txt')),
    note: 'Only ALLOWED tools reach the downstream mock server.',
  }, null, 2));

  const receipt = allowed?.result?.veorReceipt ?? null;
  const evidenceDir = path.join(root, 'evidence', 'current');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const receiptPath = path.join(evidenceDir, 'demo-receipt.json');
  const pubPath = path.join(evidenceDir, 'demo-receipt.pub.pem');
  if (receipt?.signature) {
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
    fs.writeFileSync(pubPath, receiptKeys.publicKeyPem);
    section('5) Offline proof artefact (third-party verify)');
    console.log(JSON.stringify({
      receiptFile: path.relative(root, receiptPath),
      publicKeyFile: path.relative(root, pubPath),
      verifyCommand: `node src/cli.js verify receipt ${path.relative(root, receiptPath)} --public ${path.relative(root, pubPath)}`,
      note: 'Re-run: npm run verify (exit 0 iff digest+Ed25519 hold).',
    }, null, 2));
  }

  const readyLine = Buffer.concat(stderrChunks).toString('utf8')
    .split(/\r?\n/)
    .find((line) => line.includes('[veor] gateway ready'));
  if (readyLine) {
    section('6) Gateway stderr (process identity)');
    console.log(readyLine);
  }

  console.log('\nDemo complete. This transcript was produced by the live gateway process.');
} finally {
  try {
    child.stdin.end();
  } catch { /* ignore */ }
  try {
    if (!child.killed) child.kill('SIGTERM');
  } catch { /* sandbox may deny kill; process exits with parent */ }
  try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
}
