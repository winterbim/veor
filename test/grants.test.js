import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority, issueGrant, verifyGrant, issueApproval, verifyApproval } from '../src/index.js';
import { hashObject } from '../src/canonical.js';

test('signed grants validate only for their bound subject/capability/tool and validity window', () => {
  const a = createAuthority();
  const now = new Date();
  const grant = issueGrant(a.privateKeyPem, {
    subject: 'agent-a',
    capability: 'notes.write',
    notBefore: new Date(now.getTime() - 1_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    constraints: { tools: ['notes.append'] },
  });

  assert.equal(verifyGrant(a.publicKeyPem, grant, {
    subject: 'agent-a', capability: 'notes.write', tool: 'notes.append', now: now.toISOString(),
  }).valid, true);
  assert.equal(verifyGrant(a.publicKeyPem, grant, {
    subject: 'agent-b', capability: 'notes.write', tool: 'notes.append', now: now.toISOString(),
  }).reason, 'SUBJECT_MISMATCH');
  assert.equal(verifyGrant(a.publicKeyPem, grant, {
    subject: 'agent-a', capability: 'notes.write', tool: 'notes.deleteAll', now: now.toISOString(),
  }).reason, 'TOOL_OUTSIDE_GRANT');
});

test('tampering a grant payload invalidates its signature', () => {
  const a = createAuthority();
  const grant = issueGrant(a.privateKeyPem, {
    subject: 'agent-a', capability: 'notes.write', expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  grant.payload.capability = 'root.everything';
  assert.equal(verifyGrant(a.publicKeyPem, grant).reason, 'BAD_SIGNATURE');
});

test('approvals bind to a proposal and forbid self-approval by default', () => {
  const a = createAuthority();
  const digest = hashObject({ hello: 'world' });
  const approval = issueApproval(a.privateKeyPem, {
    proposalDigest: digest,
    reviewerId: 'reviewer-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(verifyApproval(a.publicKeyPem, approval, {
    proposalDigest: digest, proposerId: 'agent-a',
  }).valid, true);
  assert.equal(verifyApproval(a.publicKeyPem, approval, {
    proposalDigest: digest, proposerId: 'reviewer-1',
  }).reason, 'SELF_APPROVAL_FORBIDDEN');
});
