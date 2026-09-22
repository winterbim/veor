import crypto from 'node:crypto';
import { hashObject } from '../canonical.js';

/**
 * Minimal zero-dep secret broker.
 * Secrets exist only in memory for the duration of an authorized effect callback.
 * Callers must never copy the secret into receipts, ledgers, or logs.
 */
export class SecretBroker {
  constructor() {
    /** @type {Map<string, string>} */
    this._secrets = new Map();
  }

  /**
   * Load a named secret. Value is held only in process memory.
   * @param {string} name
   * @param {string} value
   */
  load(name, value) {
    if (typeof name !== 'string' || !name) throw new Error('secret name is required');
    if (typeof value !== 'string' || !value) throw new Error('secret value is required');
    this._secrets.set(name, value);
  }

  /** Generate and load a disposable test secret; returns the plaintext once. */
  loadEphemeral(name, { bytes = 32 } = {}) {
    const value = crypto.randomBytes(bytes).toString('hex');
    this.load(name, value);
    return value;
  }

  has(name) {
    return this._secrets.has(name);
  }

  /**
   * Run `fn(secret)` while the named secret is available.
   * The return value of `fn` must not embed the secret (caller responsibility);
   * this helper also refuses to return the secret string itself.
   */
  withSecret(name, fn) {
    if (typeof fn !== 'function') throw new Error('effect callback is required');
    const value = this._secrets.get(name);
    if (value == null) throw new Error(`secret not available: ${name}`);
    let result;
    try {
      result = fn(value);
    } finally {
      // Intentionally keep the secret until clear(); duration = authorized effect window.
    }
    if (result === value) {
      throw new Error('secret broker refuses to return the raw secret as an effect result');
    }
    if (typeof result === 'string' && result.includes(value)) {
      throw new Error('secret broker refuses effect results that embed the secret');
    }
    return result;
  }

  digest(name) {
    const value = this._secrets.get(name);
    if (value == null) throw new Error(`secret not available: ${name}`);
    return hashObject({ secret: value });
  }

  clear(name) {
    this._secrets.delete(name);
  }

  clearAll() {
    this._secrets.clear();
  }
}

/** Redact any occurrence of known secret values from a string (for log safety). */
export function scrubSecrets(text, secrets) {
  let out = String(text ?? '');
  for (const value of secrets) {
    if (!value) continue;
    out = out.split(value).join('[REDACTED_SECRET]');
  }
  return out;
}
