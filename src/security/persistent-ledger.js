import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalJson, sha256 } from '../canonical.js';

export class PersistentLedger {
  constructor({ dir }) {
    if (!dir) throw new Error('ledger dir required');
    this.dir = path.resolve(dir);
    this.file = path.join(this.dir, 'ledger.jsonl');
    this.headFile = path.join(this.dir, 'ledger.head');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }
  records() {
    if (!fs.existsSync(this.file)) return [];
    return fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  }
  append(type, payload) {
    const records = this.records();
    const previousHash = records.at(-1)?.hash ?? 'GENESIS';
    const body = { id: randomUUID(), seq: records.length + 1, type, timestamp: new Date().toISOString(), previousHash, payload };
    const event = { ...body, hash: sha256(canonicalJson(body)) };
    fs.appendFileSync(this.file, JSON.stringify(event) + '\n', { mode: 0o600 });
    fs.writeFileSync(this.headFile, event.hash + '\n', { mode: 0o600 });
    return event;
  }
  verify() {
    const records = this.records();
    let previousHash = 'GENESIS';
    for (let i=0;i<records.length;i++) {
      const { hash, ...body } = records[i];
      if (body.seq !== i + 1) return { valid:false, reason:'SEQUENCE_MISMATCH', index:i };
      if (body.previousHash !== previousHash) return { valid:false, reason:'PREVIOUS_HASH_MISMATCH', index:i };
      if (hash !== sha256(canonicalJson(body))) return { valid:false, reason:'EVENT_HASH_MISMATCH', index:i };
      previousHash = hash;
    }
    const anchored = fs.existsSync(this.headFile) ? fs.readFileSync(this.headFile,'utf8').trim() : 'GENESIS';
    if (anchored !== previousHash) return { valid:false, reason:'HEAD_MISMATCH', head:previousHash, anchored, length:records.length };
    return { valid:true, head:previousHash, length:records.length };
  }
  tail(limit=20) { return this.records().slice(-Math.max(1, Math.min(100, Number(limit)||20))); }
}
