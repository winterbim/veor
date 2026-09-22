import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalJson, hashObject } from '../canonical.js';
import { redact } from './redact.js';

function b64u(value) { return Buffer.from(value).toString('base64url'); }
function unb64u(value) { return Buffer.from(String(value), 'base64url'); }

export function generateApprovalAuthority() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function approvalPayload(challenge) {
  return {
    kind: 'veor.one-shot-approval/v1',
    challengeId: challenge.challengeId,
    tool: challenge.tool,
    argsDigest: challenge.argsDigest,
    scope: challenge.scope,
    expiresAt: challenge.expiresAt,
  };
}

export function signChallenge(challenge, privateKeyPem) {
  const payload = approvalPayload(challenge);
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), privateKeyPem);
  return { payload, signature: b64u(signature), signedAt: new Date().toISOString() };
}

export class ApprovalStore {
  constructor({ dir, publicKeyPem = null, ttlMs = 5 * 60_000 } = {}) {
    if (!dir) throw new Error('ApprovalStore.dir is required');
    this.dir = path.resolve(dir);
    this.pendingDir = path.join(this.dir, 'pending');
    this.approvedDir = path.join(this.dir, 'approved');
    this.consumedFile = path.join(this.dir, 'consumed.jsonl');
    this.publicKeyPem = publicKeyPem;
    this.ttlMs = ttlMs;
    fs.mkdirSync(this.pendingDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(this.approvedDir, { recursive: true, mode: 0o700 });
  }

  create({ tool, args, reasons = [], scope = 'default' }) {
    const now = Date.now();
    const challenge = {
      challengeId: crypto.randomUUID(),
      tool,
      argsDigest: hashObject(args ?? {}),
      reasons: [...reasons],
      argsPreview: redact(args ?? {}),
      scope,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
    };
    challenge.challengeFile = path.join(this.pendingDir, `${challenge.challengeId}.json`);
    challenge.approvalFile = path.join(this.approvedDir, `${challenge.challengeId}.json`);
    fs.writeFileSync(challenge.challengeFile, JSON.stringify(challenge, null, 2), { mode: 0o600 });
    return challenge;
  }

  find(tool, args) {
    const digest = hashObject(args ?? {});
    for (const name of fs.readdirSync(this.pendingDir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(this.pendingDir, name), 'utf8'));
        if (c.tool === tool && c.argsDigest === digest && Date.now() < Date.parse(c.expiresAt)) return c;
      } catch {}
    }
    return null;
  }

  #consumed() {
    if (!fs.existsSync(this.consumedFile)) return new Set();
    return new Set(fs.readFileSync(this.consumedFile, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line).challengeId));
  }

  verifyAndConsume(challenge) {
    if (!challenge) return { ok: false, reason: 'NO_CHALLENGE' };
    if (Date.now() >= Date.parse(challenge.expiresAt)) return { ok: false, reason: 'EXPIRED' };
    if (this.#consumed().has(challenge.challengeId)) return { ok: false, reason: 'REPLAYED' };
    if (!this.publicKeyPem) return { ok: false, reason: 'NO_APPROVAL_PUBLIC_KEY' };
    if (!fs.existsSync(challenge.approvalFile)) return { ok: false, reason: 'NOT_APPROVED' };

    let approval;
    try { approval = JSON.parse(fs.readFileSync(challenge.approvalFile, 'utf8')); }
    catch (error) { return { ok: false, reason: `BAD_APPROVAL_JSON:${error.message}` }; }
    const expected = approvalPayload(challenge);
    if (canonicalJson(approval.payload) !== canonicalJson(expected)) return { ok: false, reason: 'PAYLOAD_MISMATCH' };
    const ok = crypto.verify(null, Buffer.from(canonicalJson(expected)), this.publicKeyPem, unb64u(approval.signature));
    if (!ok) return { ok: false, reason: 'BAD_SIGNATURE' };

    fs.appendFileSync(this.consumedFile, JSON.stringify({ challengeId: challenge.challengeId, consumedAt: new Date().toISOString(), signatureDigest: hashObject(approval.signature) }) + '\n', { mode: 0o600 });
    fs.rmSync(challenge.approvalFile, { force: true });
    fs.rmSync(challenge.challengeFile, { force: true });
    return { ok: true, reason: 'CONSUMED' };
  }
}
