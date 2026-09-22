#!/usr/bin/env node
/**
 * Cursor host hook for VEOR dogfood.
 * Event: beforeShellExecution / beforeMCPExecution (JSON on stdin).
 *
 * Policy for THIS repo's agent surface:
 * - Commands that look like gated repo effects (veor-gated / VEOR_REQUIRE_RECEIPT)
 *   are denied unless a valid receipt + public key are supplied via env.
 * - Ordinary shell is allowed through (threat model: same-user shell outside
 *   this hook is still not covered — see docs/THREAT_MODEL.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateRepoEffect, toHookResponse } from '../../src/host/repo-effect-gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

function isGatedCommand(command) {
  const text = String(command ?? '');
  if (process.env.VEOR_REQUIRE_RECEIPT === '1') return true;
  if (/\bveor-gated\b/.test(text)) return true;
  if (/scripts\/veor-gated-effect\.js/.test(text)) return true;
  return false;
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

if (!isGatedCommand(command) && process.env.VEOR_REQUIRE_RECEIPT !== '1') {
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
