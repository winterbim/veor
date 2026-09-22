import { randomUUID } from 'node:crypto';
import { canonicalJson, sha256 } from './canonical.js';

export class EvidenceLedger {
  constructor() {
    this.events = [];
  }

  append(type, payload, timestamp = new Date().toISOString()) {
    const previousHash = this.events.length ? this.events.at(-1).hash : 'GENESIS';
    const body = {
      id: randomUUID(),
      type,
      timestamp,
      previousHash,
      payload: structuredClone(payload),
    };
    const hash = sha256(canonicalJson(body));
    const event = { ...body, hash };
    this.events.push(event);
    return structuredClone(event);
  }

  verifyChain(expectedHead = null) {
    let previousHash = 'GENESIS';
    for (let i = 0; i < this.events.length; i += 1) {
      const event = this.events[i];
      if (event.previousHash !== previousHash) {
        return { valid: false, index: i, reason: 'PREVIOUS_HASH_MISMATCH' };
      }
      const { hash, ...body } = event;
      const expected = sha256(canonicalJson(body));
      if (hash !== expected) {
        return { valid: false, index: i, reason: 'EVENT_HASH_MISMATCH' };
      }
      previousHash = hash;
    }
    if (expectedHead && previousHash !== expectedHead) {
      return { valid: false, reason: 'HEAD_MISMATCH', head: previousHash, expectedHead, length: this.events.length };
    }
    return { valid: true, head: previousHash, length: this.events.length };
  }

  snapshot() {
    return structuredClone(this.events);
  }
}
