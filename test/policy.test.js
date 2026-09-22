import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthority, issueGrant, issueApproval, PolicyKernel, Decision, tighten, hashObject,
} from '../src/index.js';

function safeSignals(overrides = {}) {
  return {
    risk: 0.1,
    destructiveProbability: 0.02,
    irreversibleProbability: 0.03,
    humanReviewProbability: 0.05,
    evidenceScore: 4,
    minConfidence: 0.95,
    ...overrides,
  };
}

function proposal() {
  return {
    subject: 'agent-a', capability: 'notes.write', tool: 'notes.append',
    objective: 'write note', args: { text: 'hello' }, proposedAt: new Date().toISOString(),
  };
}

test('missing capability grant fails closed', () => {
  const a = createAuthority();
  const kernel = new PolicyKernel({ authorityPublicKeyPem: a.publicKeyPem });
  const result = kernel.evaluate({ proposal: proposal(), grantToken: null, signals: safeSignals() });
  assert.equal(result.decision, Decision.DENY);
  assert.match(result.reasons[0], /GRANT_/);
});

test('valid grant plus low-risk signals can allow', () => {
  const a = createAuthority();
  const p = proposal();
  const grant = issueGrant(a.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    constraints: { tools: [p.tool] },
  });
  const kernel = new PolicyKernel({ authorityPublicKeyPem: a.publicKeyPem });
  const result = kernel.evaluate({ proposal: p, grantToken: grant, signals: safeSignals() });
  assert.equal(result.decision, Decision.ALLOW);
});

test('high-risk advisory signal can only tighten an otherwise valid grant', () => {
  const a = createAuthority();
  const p = proposal();
  const grant = issueGrant(a.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    constraints: { tools: [p.tool] },
  });
  const kernel = new PolicyKernel({ authorityPublicKeyPem: a.publicKeyPem });
  const result = kernel.evaluate({
    proposal: p,
    grantToken: grant,
    signals: safeSignals({ risk: 0.8, destructiveProbability: 0.9 }),
  });
  assert.equal(result.decision, Decision.REVIEW);
  assert.equal(tighten(Decision.DENY, Decision.ALLOW), Decision.DENY);
  assert.equal(tighten(Decision.REVIEW, Decision.ALLOW), Decision.REVIEW);
});

test('probabilistic safety cannot override deterministic denial', () => {
  const a = createAuthority();
  const p = proposal();
  const wrongGrant = issueGrant(a.privateKeyPem, {
    subject: 'somebody-else', capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const kernel = new PolicyKernel({ authorityPublicKeyPem: a.publicKeyPem });
  const result = kernel.evaluate({ proposal: p, grantToken: wrongGrant, signals: safeSignals() });
  assert.equal(result.decision, Decision.DENY);
});

test('signed independent approval may resolve review but never deterministic denial', () => {
  const a = createAuthority();
  const p = proposal();
  const grant = issueGrant(a.privateKeyPem, {
    subject: p.subject, capability: p.capability, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    constraints: { tools: [p.tool] },
  });
  const approval = issueApproval(a.privateKeyPem, {
    proposalDigest: hashObject(p),
    reviewerId: 'reviewer-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const kernel = new PolicyKernel({ authorityPublicKeyPem: a.publicKeyPem });
  const result = kernel.evaluate({
    proposal: p,
    grantToken: grant,
    signals: safeSignals({ risk: 0.8 }),
    approvalToken: approval,
  });
  assert.equal(result.decision, Decision.ALLOW);

  const denied = kernel.evaluate({
    proposal: p,
    grantToken: null,
    signals: safeSignals(),
    approvalToken: approval,
  });
  assert.equal(denied.decision, Decision.DENY);
});
