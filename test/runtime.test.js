import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthority, issueGrant, EvidenceLedger, FunctionReflexProvider,
  InMemoryExecutor, PolicyKernel, VeorRuntime,
} from '../src/index.js';

function providerFor(risky = false) {
  return new FunctionReflexProvider(async () => [
    { id: 'risk_band', type: 'choice', answer: risky ? 'high' : 'low', confidence: 0.95 },
    { id: 'destructive', type: 'truth', probability: risky ? 0.9 : 0.01, confidence: 0.95 },
    { id: 'irreversible', type: 'truth', probability: risky ? 0.8 : 0.01, confidence: 0.95 },
    { id: 'needs_human', type: 'truth', probability: risky ? 0.9 : 0.01, confidence: 0.95 },
    { id: 'evidence_sufficiency', type: 'score', value: 4, confidence: 0.95 },
  ]);
}

test('runtime executes only after policy allow and verifies separately', async () => {
  const authority = createAuthority();
  const executor = new InMemoryExecutor();
  const ledger = new EvidenceLedger();
  const p = { subject: 'agent-a', capability: 'notes.write', tool: 'notes.append', objective: 'append', args: { text: 'x' } };
  const grant = issueGrant(authority.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(), constraints: { tools: [p.tool] },
  });
  const runtime = new VeorRuntime({
    reflexProvider: providerFor(false),
    policyKernel: new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem }),
    executor,
    ledger,
  });
  const result = await runtime.run({ proposal: p, grantToken: grant, verify: ({ after }) => after.notes.length === 1 });
  assert.equal(result.outcome, 'VERIFIED');
  assert.equal(result.executed, true);
  assert.equal(result.verified, true);
  assert.equal(ledger.verifyChain().valid, true);
});

test('runtime does not execute when advisory risk forces review', async () => {
  const authority = createAuthority();
  const executor = new InMemoryExecutor({ notes: ['preserve'] });
  const ledger = new EvidenceLedger();
  const p = { subject: 'agent-a', capability: 'notes.admin', tool: 'notes.deleteAll', objective: 'delete all', args: {} };
  const grant = issueGrant(authority.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(), constraints: { tools: [p.tool] },
  });
  const runtime = new VeorRuntime({
    reflexProvider: providerFor(true),
    policyKernel: new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem }),
    executor,
    ledger,
  });
  const result = await runtime.run({ proposal: p, grantToken: grant, verify: ({ after }) => after.notes.length === 0 });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.executed, false);
  assert.deepEqual(executor.state.notes, ['preserve']);
});

test('execution success without a true postcondition is not reported as verified', async () => {
  const authority = createAuthority();
  const executor = new InMemoryExecutor();
  const p = { subject: 'agent-a', capability: 'notes.write', tool: 'notes.append', objective: 'append', args: { text: 'x' } };
  const grant = issueGrant(authority.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(), constraints: { tools: [p.tool] },
  });
  const runtime = new VeorRuntime({
    reflexProvider: providerFor(false),
    policyKernel: new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem }),
    executor,
    ledger: new EvidenceLedger(),
  });
  const result = await runtime.run({ proposal: p, grantToken: grant, verify: () => false });
  assert.equal(result.executed, true);
  assert.equal(result.verified, false);
  assert.equal(result.outcome, 'EXECUTED_UNVERIFIED');
});

test('malformed advisory probabilities fail conservatively instead of becoming safer', async () => {
  const authority = createAuthority();
  const executor = new InMemoryExecutor({ notes: ['preserve'] });
  const p = { subject: 'agent-a', capability: 'notes.admin', tool: 'notes.deleteAll', objective: 'delete all', args: {} };
  const grant = issueGrant(authority.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(), constraints: { tools: [p.tool] },
  });
  const malformed = new FunctionReflexProvider(async () => [
    { id: 'risk_band', type: 'choice', answer: 'low', confidence: 1 },
    { id: 'destructive', type: 'truth', probability: -100, confidence: 1 },
    { id: 'irreversible', type: 'truth', probability: -100, confidence: 1 },
    { id: 'needs_human', type: 'truth', probability: -100, confidence: 1 },
    { id: 'evidence_sufficiency', type: 'score', value: 4, confidence: 1 },
  ]);
  const runtime = new VeorRuntime({
    reflexProvider: malformed,
    policyKernel: new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem }),
    executor,
    ledger: new EvidenceLedger(),
  });
  const result = await runtime.run({ proposal: p, grantToken: grant, verify: () => true });
  assert.notEqual(result.outcome, 'VERIFIED');
  assert.equal(result.executed, false);
});
