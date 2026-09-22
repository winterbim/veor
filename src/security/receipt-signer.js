import crypto from 'node:crypto';
import { canonicalJson, hashObject } from '../canonical.js';

export function generateReceiptAuthority() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export class ReceiptSigner {
  constructor({ privateKeyPem, keyId = 'veor-receipt-key' }) {
    if (!privateKeyPem) throw new Error('receipt private key is required');
    this.privateKeyPem = privateKeyPem;
    this.keyId = keyId;
  }
  sign(receipt) {
    const body = { kind: 'veor.execution-receipt/v1', keyId: this.keyId, ...receipt };
    const signature = crypto.sign(null, Buffer.from(canonicalJson(body)), this.privateKeyPem).toString('base64url');
    return { body, signature, digest: hashObject(body) };
  }
  static verify(publicKeyPem, signed) {
    if (!signed?.body || !signed?.signature) return false;
    return crypto.verify(null, Buffer.from(canonicalJson(signed.body)), publicKeyPem, Buffer.from(signed.signature, 'base64url'));
  }
}
