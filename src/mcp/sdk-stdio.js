#!/usr/bin/env node
/**
 * Official MCP SDK stdio transport in front of the same decision kernel.
 * Protocol versions are whatever @modelcontextprotocol/sdk actually negotiates
 * (1.30.0 latest is 2025-11-25). This file does not claim 2026-07-28.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PolicyBundle } from '../policy-bundle.js';
import { Decision } from '../decision.js';
import { hashObject } from '../canonical.js';
import { DecisionKernel } from '../kernel/decision-kernel.js';
import { ApprovalStore } from '../security/approval-store.js';
import { PersistentLedger } from '../security/persistent-ledger.js';
import { ReceiptSigner } from '../security/receipt-signer.js';
import { CatalogGuard } from './catalog-guard.js';

function parseJsonEnv(name, fallback) {
  if (!process.env[name]) return fallback;
  return JSON.parse(process.env[name]);
}

const downstreamArgv = parseJsonEnv('VEOR_DOWNSTREAM_JSON', null);
if (!Array.isArray(downstreamArgv) || downstreamArgv.length === 0) {
  throw new Error('VEOR_DOWNSTREAM_JSON must be a non-empty argv array');
}

const policy = PolicyBundle.load(process.env.VEOR_POLICY ?? 'veor.policy.json');
const runtimeDir = process.env.VEOR_RUNTIME_DIR ?? path.join(os.homedir(), '.local', 'state', 'veor', 'sdk-gateway');
const approvalPublicKeyPem = process.env.VEOR_APPROVAL_PUBLIC_KEY && fs.existsSync(process.env.VEOR_APPROVAL_PUBLIC_KEY)
  ? fs.readFileSync(process.env.VEOR_APPROVAL_PUBLIC_KEY, 'utf8')
  : null;
const receiptPrivateKeyPem = process.env.VEOR_RECEIPT_PRIVATE_KEY && fs.existsSync(process.env.VEOR_RECEIPT_PRIVATE_KEY)
  ? fs.readFileSync(process.env.VEOR_RECEIPT_PRIVATE_KEY, 'utf8')
  : null;
const ledger = new PersistentLedger({ dir: path.join(runtimeDir, 'ledger') });
const approvals = new ApprovalStore({ dir: path.join(runtimeDir, 'approvals'), publicKeyPem: approvalPublicKeyPem });
const receiptSigner = receiptPrivateKeyPem ? new ReceiptSigner({ privateKeyPem: receiptPrivateKeyPem }) : null;
const kernel = new DecisionKernel({ policy, approvals, ledger, receiptSigner });
const catalogGuard = new CatalogGuard({ file: path.join(runtimeDir, 'catalog.sha256') });

const child = spawn(downstreamArgv[0], downstreamArgv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
child.stderr.on('data', (chunk) => process.stderr.write(`[downstream] ${chunk}`));
let seq = 1000;
const pending = new Map();
let tools = [];
let catalog = null;
createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id != null && pending.has(message.id)) {
    const resolve = pending.get(message.id);
    pending.delete(message.id);
    resolve(message);
  }
});

function request(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`downstream timeout: ${method}`));
    }, 30000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function refreshTools() {
  const listed = await request('tools/list', {});
  if (listed.error) throw new Error(listed.error.message);
  tools = listed.result?.tools ?? [];
  catalog = catalogGuard.check(tools);
  return tools;
}

function toolByName(name) {
  return tools.find((tool) => tool.name === name);
}

function blocked(decision) {
  const signedReceipt = kernel.receipt({
    decisionRecord: decision.record,
    resultDigest: null,
    executed: false,
    verified: null,
    sandbox: null,
  });
  return {
    content: [{ type: 'text', text: `VEOR ${decision.decision}: tool not executed.` }],
    structuredContent: {
      veor: {
        decision: decision.decision,
        executed: false,
        reasons: decision.reasons,
        receipt: signedReceipt?.signature ? signedReceipt : null,
      },
    },
    isError: true,
  };
}

const server = new Server(
  { name: 'veor-gateway', version: '0.4.0-dev.5' },
  {
    capabilities: { tools: {} },
    instructions: `VEOR policy ${policy.digest.slice(0, 12)} is active. Official SDK transport; authority stays in the decision kernel.`,
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const listed = await refreshTools();
  return {
    tools: [
      { name: 'veor_status', description: 'Inspect VEOR policy and ledger.', inputSchema: { type: 'object', properties: {} } },
      ...listed,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (requestMessage) => {
  const name = requestMessage.params.name;
  const args = requestMessage.params.arguments ?? {};
  if (name === 'veor_status') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ policyDigest: policy.digest, catalog, ledger: ledger.verify() }) }],
      structuredContent: { policyDigest: policy.digest, catalog, ledger: ledger.verify() },
      isError: false,
    };
  }
  if (!tools.length) await refreshTools();
  const tool = toolByName(name);
  if (!tool) {
    const decision = kernel.decide({
      tool: { name, annotations: { destructiveHint: true } },
      args,
      advisoryDecision: Decision.ALLOW,
      catalogFingerprint: catalog?.current,
    });
    return blocked(decision);
  }
  const decision = kernel.decide({
    tool,
    args,
    advisoryDecision: Decision.ALLOW,
    catalogFingerprint: catalog?.current,
  });
  if (decision.decision !== Decision.ALLOW) return blocked(decision);
  const downstreamResult = await request('tools/call', { name, arguments: args });
  const digest = hashObject(downstreamResult.result ?? downstreamResult.error ?? null);
  const signedReceipt = kernel.receipt({
    decisionRecord: decision.record,
    resultDigest: digest,
    executed: true,
    verified: null,
    sandbox: null,
  });
  if (downstreamResult.error) {
    return {
      content: [{ type: 'text', text: downstreamResult.error.message }],
      structuredContent: { veorReceipt: signedReceipt },
      isError: true,
    };
  }
  return {
    ...downstreamResult.result,
    veorReceipt: signedReceipt,
    structuredContent: {
      ...(downstreamResult.result?.structuredContent ?? {}),
      veor: { decision: 'ALLOW', executed: true, receipt: signedReceipt },
    },
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[veor] sdk gateway ready policy=${policy.digest.slice(0, 12)} sdk=@modelcontextprotocol/sdk\n`);
