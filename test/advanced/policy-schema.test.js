import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PolicyBundle } from '../../src/policy-bundle.js';
import { validatePolicyV1, assertPolicyV1, POLICY_MONOTONE_RULE } from '../../src/policy-schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = path.join(root, 'examples', 'fixtures');

test('policy schema documents monotone composition', () => {
  assert.equal(POLICY_MONOTONE_RULE.composition, 'decision = max(deterministic, advisory)');
  assert.equal(POLICY_MONOTONE_RULE.order, 'ALLOW < REVIEW < DENY');
});

test('fixture DENY: unknown tools fail closed', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(fixtures, 'policy-deny.json'), 'utf8'));
  assert.equal(validatePolicyV1(raw).ok, true);
  const p = new PolicyBundle(raw, { baseDir: root });
  const r = p.evaluateTool({ tool: { name: 'surprise.delete', annotations: { readOnlyHint: true } }, args: {} });
  assert.equal(r.decision, 'DENY');
  assert.ok(r.reasons.includes('UNKNOWN_TOOL'));
});

test('fixture REVIEW: write stays REVIEW even if advisory says ALLOW', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(fixtures, 'policy-review.json'), 'utf8'));
  assert.equal(validatePolicyV1(raw).ok, true);
  const outRoot = path.join(root, '.veor', 'output');
  fs.mkdirSync(outRoot, { recursive: true });
  const p = new PolicyBundle(raw, { baseDir: root });
  const r = p.evaluateTool({
    tool: { name: 'filesystem.write_file', annotations: { readOnlyHint: false } },
    args: { path: path.join(outRoot, 'x.txt') },
    advisoryDecision: 'ALLOW',
  });
  assert.equal(r.decision, 'REVIEW');
});

test('fixture ALLOW: annotated read is ALLOW under policy', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(fixtures, 'policy-allow.json'), 'utf8'));
  assert.equal(validatePolicyV1(raw).ok, true);
  const p = new PolicyBundle(raw, { baseDir: root });
  const r = p.evaluateTool({
    tool: { name: 'filesystem.read_file', annotations: { readOnlyHint: true } },
    args: { path: path.join(root, 'README.md') },
  });
  assert.equal(r.decision, 'ALLOW');
});

test('schema rejects policy that would let advisory weaken severity', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(fixtures, 'policy-illegal-weaken.json'), 'utf8'));
  const v = validatePolicyV1(raw);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.path.includes('advisoryMayWeaken')));
  assert.throws(() => assertPolicyV1(raw), /advisoryMayWeaken|weaken/);
  assert.throws(() => new PolicyBundle(raw), /invalid veor.policy\/v1/);
});

test('schema rejects unknown decision enum', () => {
  const v = validatePolicyV1({
    kind: 'veor.policy/v1',
    mcp: { tools: { t: { decision: 'PERMIT' } } },
  });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.path.includes('decision')));
});
