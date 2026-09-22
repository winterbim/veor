import fs from 'node:fs';
import path from 'node:path';
import { hashObject } from '../canonical.js';
import { ReceiptSigner } from './receipt-signer.js';
import { PersistentLedger } from './persistent-ledger.js';

/**
 * Offline third-party verification of a signed execution receipt.
 * Proves: body digest + Ed25519 signature over canonicalJson(body).
 * Does not prove: host bypass absence, osEnforced truth beyond the body field, or signer identity.
 */
export function verifyReceipt(signed, publicKeyPem, { ledgerDir = null } = {}) {
  const result = {
    ok: false,
    kind: 'veor.receipt-verify/v1',
    checks: {
      structure: false,
      digest: false,
      signature: false,
      ledger: ledgerDir ? false : null,
    },
    reasons: [],
    digest: null,
    receiptId: null,
  };

  if (!signed || typeof signed !== 'object') {
    result.reasons.push('MISSING_RECEIPT');
    return result;
  }
  if (!signed.body || typeof signed.body !== 'object') {
    result.reasons.push('MISSING_BODY');
    return result;
  }
  if (typeof signed.signature !== 'string' || !signed.signature) {
    result.reasons.push('MISSING_SIGNATURE');
    return result;
  }
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    result.reasons.push('MISSING_OR_INVALID_PUBLIC_KEY');
    return result;
  }
  if (signed.body.kind !== 'veor.execution-receipt/v1') {
    result.reasons.push('UNEXPECTED_KIND');
    return result;
  }
  result.checks.structure = true;
  result.receiptId = signed.body.receiptId ?? null;

  const computed = hashObject(signed.body);
  result.digest = computed;
  if (signed.digest != null && signed.digest !== computed) {
    result.reasons.push('DIGEST_MISMATCH');
    return result;
  }
  result.checks.digest = true;

  let signatureOk = false;
  try {
    signatureOk = ReceiptSigner.verify(publicKeyPem, signed);
  } catch {
    result.reasons.push('SIGNATURE_VERIFY_ERROR');
    return result;
  }
  if (!signatureOk) {
    result.reasons.push('BAD_SIGNATURE');
    return result;
  }
  result.checks.signature = true;

  if (ledgerDir) {
    const ledger = new PersistentLedger({ dir: path.resolve(ledgerDir) });
    const chain = ledger.verify();
    if (!chain.valid) {
      result.reasons.push(`LEDGER_${chain.reason}`);
      return result;
    }
    const found = ledger.records().some((event) => {
      if (event.type !== 'receipt') return false;
      const payload = event.payload;
      if (!payload?.body || !payload?.signature) return false;
      return hashObject(payload.body) === computed && payload.signature === signed.signature;
    });
    if (!found) {
      result.reasons.push('RECEIPT_NOT_IN_LEDGER');
      return result;
    }
    result.checks.ledger = true;
  }

  result.ok = true;
  result.reasons.push('OK');
  return result;
}

export function verifyReceiptFile(receiptPath, publicKeyPath, options = {}) {
  const signed = JSON.parse(fs.readFileSync(path.resolve(receiptPath), 'utf8'));
  const publicKeyPem = fs.readFileSync(path.resolve(publicKeyPath), 'utf8');
  return verifyReceipt(signed, publicKeyPem, options);
}

export function verifyLedgerDir(ledgerDir) {
  const ledger = new PersistentLedger({ dir: path.resolve(ledgerDir) });
  const chain = ledger.verify();
  return {
    ok: chain.valid,
    kind: 'veor.ledger-verify/v1',
    ...chain,
  };
}
