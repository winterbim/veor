import fs from 'node:fs';
import path from 'node:path';
import { hashObject } from '../canonical.js';

export function catalogFingerprint(tools) {
  return hashObject((tools ?? []).map(tool => ({ name:tool.name, description:tool.description ?? '', inputSchema:tool.inputSchema ?? {}, annotations:tool.annotations ?? {} })).sort((a,b)=>a.name.localeCompare(b.name)));
}

export class CatalogGuard {
  constructor({ file }) { this.file = path.resolve(file); }
  check(tools) {
    const current = catalogFingerprint(tools);
    if (!fs.existsSync(this.file)) {
      fs.mkdirSync(path.dirname(this.file), { recursive:true, mode:0o700 });
      fs.writeFileSync(this.file, current + '\n', { mode:0o600 });
      return { status:'BASELINED', current, changed:false };
    }
    const baseline = fs.readFileSync(this.file,'utf8').trim();
    return { status: baseline === current ? 'MATCH' : 'DRIFT', baseline, current, changed:baseline !== current };
  }
  accept(tools) {
    const current = catalogFingerprint(tools);
    fs.mkdirSync(path.dirname(this.file), { recursive:true, mode:0o700 });
    fs.writeFileSync(this.file, current + '\n', { mode:0o600 });
    return current;
  }
}
