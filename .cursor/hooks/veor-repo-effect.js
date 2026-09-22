#!/usr/bin/env node
/**
 * Cursor host hook for VEOR dogfood.
 * beforeShellExecution in this repo is default-deny.
 * Maintenance commands with no shell metacharacters are allowed.
 * Every other shell command needs a valid VEOR receipt in the environment.
 * A shell that never enters this hook (terminal outside Cursor) is still uncovered.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateRepoEffect, toHookResponse } from '../../src/host/repo-effect-gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAINTENANCE = /^(npm (test|run (check|demo|self|verify|verify:self|sandbox:info))|git (status|diff|log)( [A-Za-z0-9_.=/@+-]+)*|node --test( [A-Za-z0-9_.=/@+-]+)*)$/;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.resume();
  });
}

function loadReceiptFromEnv() {
  const receiptPath = process.env.VEOR_EFFECT_RECEIPT;
  const pubPath = process.env.VEOR_EFFECT_RECEIPT_PUB
    ?? path.join(root, 'evidence/current/self-allow-receipt.pub.pem');
  if (!receiptPath || !fs.existsSync(receiptPath)) {
    return { receipt: null, publicKeyPem: null };
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const publicKeyPem = fs.existsSync(pubPath) ? fs.readFileSync(pubPath, 'utf8') : null;
  return { receipt, publicKeyPem };
}

function isMaintenance(command) {
  const text = String(command ?? '').trim();
  if (!text || /[;&|`$<>\n]|\$(?:\(|\{)/.test(text)) return false;
  return MAINTENANCE.test(text);
}

const raw = await readStdin();
let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  input = {};
}

const command = input.command ?? input.tool_input?.command ?? '';
const tool = input.tool_name ?? input.toolName ?? process.env.VEOR_EFFECT_TOOL ?? null;

if (!String(command).trim() || isMaintenance(command)) {
  process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
  process.exit(0);
}

const { receipt, publicKeyPem } = loadReceiptFromEnv();
const gate = gateRepoEffect({
  receipt,
  publicKeyPem,
  tool: tool || undefined,
  requireExecuted: true,
});
process.stdout.write(JSON.stringify(toHookResponse(gate)) + '\n');
process.exit(gate.ok ? 0 : 2);
