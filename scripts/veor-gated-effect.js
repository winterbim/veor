#!/usr/bin/env node
/**
 * Wrapper for repo-gated effects: refuses to run unless a valid VEOR receipt is present.
 * Usage:
 *   VEOR_EFFECT_RECEIPT=path VEOR_EFFECT_RECEIPT_PUB=path \
 *     node scripts/veor-gated-effect.js --tool NAME -- -- command args...
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gateRepoEffect } from '../src/host/repo-effect-gate.js';

const args = process.argv.slice(2);
function value(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const sep = args.indexOf('--');
const argv = sep >= 0 ? args.slice(sep + 1) : [];
const tool = value('--tool') ?? process.env.VEOR_EFFECT_TOOL ?? 'veor.gated';
const receiptPath = value('--receipt') ?? process.env.VEOR_EFFECT_RECEIPT;
const pubPath = value('--public') ?? process.env.VEOR_EFFECT_RECEIPT_PUB;

if (!receiptPath || !pubPath) {
  console.error(JSON.stringify({
    ok: false,
    reasons: ['MISSING_VEOR_RECEIPT_OR_PUBLIC_KEY'],
    note: 'Provide --receipt/--public or VEOR_EFFECT_RECEIPT / VEOR_EFFECT_RECEIPT_PUB',
  }));
  process.exit(2);
}
if (!argv.length) {
  console.error(JSON.stringify({ ok: false, reasons: ['MISSING_COMMAND'] }));
  process.exit(2);
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const publicKeyPem = fs.readFileSync(pubPath, 'utf8');
const gate = gateRepoEffect({ receipt, publicKeyPem, tool, requireExecuted: true });
if (!gate.ok) {
  console.error(JSON.stringify({ ok: false, ...gate }, null, 2));
  process.exit(2);
}

const run = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit', shell: false });
process.exit(run.status == null ? 1 : run.status);
