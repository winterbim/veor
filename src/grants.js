import { generateKeyPairSync, sign, verify, randomUUID } from 'node:crypto';
import { assertJsonSafe, canonicalJson } from './canonical.js';

function assertIsoDate(value, field) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${field} must be an ISO date`);
  return ms;
}

export function createAuthority() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function issueGrant(privateKeyPem, {
  issuer = 'veor-authority',
  subject,
  capability,
  notBefore = new Date().toISOString(),
  expiresAt,
  constraints = {},
  grantId = randomUUID(),
}) {
  if (!subject) throw new Error('subject is required');
  assertJsonSafe(constraints, 'constraints');
  if (!capability) throw new Error('capability is required');
  assertIsoDate(notBefore, 'notBefore');
  assertIsoDate(expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(notBefore)) {
    throw new Error('expiresAt must be later than notBefore');
  }

  const payload = {
    kind: 'veor.capability-grant/v1',
    grantId,
    issuer,
    subject,
    capability,
    notBefore,
    expiresAt,
    constraints,
  };
  const signature = sign(null, Buffer.from(canonicalJson(payload)), privateKeyPem).toString('base64url');
  return { payload, signature };
}

export function verifyGrant(publicKeyPem, token, { subject, capability, tool, now = new Date().toISOString() } = {}) {
  try {
    if (!token?.payload || typeof token.signature !== 'string') {
      return { valid: false, reason: 'MALFORMED_GRANT' };
    }
    const p = token.payload;
    if (p.kind !== 'veor.capability-grant/v1') return { valid: false, reason: 'WRONG_GRANT_KIND' };
    const ok = verify(
      null,
      Buffer.from(canonicalJson(p)),
      publicKeyPem,
      Buffer.from(token.signature, 'base64url'),
    );
    if (!ok) return { valid: false, reason: 'BAD_SIGNATURE' };

    const nowMs = assertIsoDate(now, 'now');
    if (nowMs < assertIsoDate(p.notBefore, 'notBefore')) return { valid: false, reason: 'NOT_YET_VALID' };
    if (nowMs >= assertIsoDate(p.expiresAt, 'expiresAt')) return { valid: false, reason: 'EXPIRED' };
    if (subject && p.subject !== subject) return { valid: false, reason: 'SUBJECT_MISMATCH' };
    if (capability && p.capability !== capability) return { valid: false, reason: 'CAPABILITY_MISMATCH' };

    const tools = p.constraints?.tools;
    if (tool && Array.isArray(tools) && !tools.includes(tool)) {
      return { valid: false, reason: 'TOOL_OUTSIDE_GRANT' };
    }

    return { valid: true, reason: 'VALID', grant: p };
  } catch (error) {
    return { valid: false, reason: 'GRANT_VALIDATION_ERROR', error: error.message };
  }
}

export function issueApproval(privateKeyPem, {
  proposalDigest,
  reviewerId,
  expiresAt,
  approvalId = randomUUID(),
  issuer = 'veor-authority',
}) {
  if (!proposalDigest || !reviewerId) throw new Error('proposalDigest and reviewerId are required');
  assertIsoDate(expiresAt, 'expiresAt');
  const issuedAt = new Date().toISOString();
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('expiresAt must be in the future');
  const payload = {
    kind: 'veor.approval/v1',
    approvalId,
    issuer,
    proposalDigest,
    reviewerId,
    decision: 'approve',
    issuedAt,
    expiresAt,
  };
  const signature = sign(null, Buffer.from(canonicalJson(payload)), privateKeyPem).toString('base64url');
  return { payload, signature };
}

export function verifyApproval(publicKeyPem, token, {
  proposalDigest,
  proposerId,
  now = new Date().toISOString(),
  requireDistinctReviewer = true,
} = {}) {
  try {
    if (!token?.payload || typeof token.signature !== 'string') {
      return { valid: false, reason: 'MALFORMED_APPROVAL' };
    }
    const p = token.payload;
    if (p.kind !== 'veor.approval/v1') return { valid: false, reason: 'WRONG_APPROVAL_KIND' };
    const ok = verify(
      null,
      Buffer.from(canonicalJson(p)),
      publicKeyPem,
      Buffer.from(token.signature, 'base64url'),
    );
    if (!ok) return { valid: false, reason: 'BAD_APPROVAL_SIGNATURE' };
    if (p.proposalDigest !== proposalDigest) return { valid: false, reason: 'PROPOSAL_MISMATCH' };
    if (p.decision !== 'approve') return { valid: false, reason: 'NOT_APPROVED' };
    const nowMs = assertIsoDate(now, 'now');
    if (nowMs < assertIsoDate(p.issuedAt, 'issuedAt')) return { valid: false, reason: 'APPROVAL_NOT_YET_VALID' };
    if (nowMs >= assertIsoDate(p.expiresAt, 'expiresAt')) return { valid: false, reason: 'APPROVAL_EXPIRED' };
    if (requireDistinctReviewer && proposerId && p.reviewerId === proposerId) {
      return { valid: false, reason: 'SELF_APPROVAL_FORBIDDEN' };
    }
    return { valid: true, reason: 'VALID', approval: p };
  } catch (error) {
    return { valid: false, reason: 'APPROVAL_VALIDATION_ERROR', error: error.message };
  }
}
