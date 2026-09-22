import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { EvidenceLedger } from './ledger.js';

export class FileEvidenceLedger extends EvidenceLedger {
  constructor({ file, headFile = `${file}.head` }) {
    super();
    if (typeof file !== 'string' || file.length === 0) throw new Error('file is required');
    this.file = path.resolve(file);
    this.headFile = path.resolve(headFile);
    this.ready = false;
  }

  async load() {
    if (this.ready) return this;
    try {
      const body = await readFile(this.file, 'utf8');
      this.events = body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const verification = this.verifyChain();
    if (!verification.valid) throw new Error(`LEDGER_INVALID:${verification.reason}`);
    this.ready = true;
    return this;
  }

  async appendPersistent(type, payload, timestamp = new Date().toISOString()) {
    await this.load();
    const event = super.append(type, payload, timestamp);
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(event)}\n`, 'utf8');
    await writeFile(this.headFile, `${event.hash}\n`, 'utf8');
    return event;
  }

  append() {
    throw new Error('FileEvidenceLedger requires async appendPersistent(); use AsyncFileLedgerAdapter with VeorRuntime');
  }

  async verifyPersistedHead() {
    await this.load();
    let expectedHead = null;
    try {
      expectedHead = (await readFile(this.headFile, 'utf8')).trim() || null;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return this.verifyChain(expectedHead);
  }
}

export class AsyncFileLedgerAdapter {
  constructor(fileLedger) {
    this.fileLedger = fileLedger;
  }

  append(type, payload, timestamp) {
    const previousHash = this.fileLedger.events.length ? this.fileLedger.events.at(-1).hash : 'GENESIS';
    // Runtime's current ledger contract is synchronous. Persistent writes are queued,
    // while the in-memory event is appended synchronously to preserve ordering.
    const event = EvidenceLedger.prototype.append.call(this.fileLedger, type, payload, timestamp);
    this.pending = (this.pending ?? Promise.resolve()).then(async () => {
      await mkdir(path.dirname(this.fileLedger.file), { recursive: true });
      await appendFile(this.fileLedger.file, `${JSON.stringify(event)}\n`, 'utf8');
      await writeFile(this.fileLedger.headFile, `${event.hash}\n`, 'utf8');
    });
    if (event.previousHash !== previousHash) throw new Error('LEDGER_ORDER_VIOLATION');
    return event;
  }

  verifyChain(expectedHead = null) {
    return this.fileLedger.verifyChain(expectedHead);
  }

  snapshot() {
    return this.fileLedger.snapshot();
  }

  async flush() {
    await (this.pending ?? Promise.resolve());
  }
}
