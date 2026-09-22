import { mkdir, readFile, rm, stat, writeFile, realpath } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

function insideRoot(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function nearestExistingSync(candidate) {
  let current = path.resolve(candidate);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

export class FileSystemExecutor {
  constructor({ root }) {
    if (typeof root !== 'string' || root.length === 0) throw new Error('root is required');
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
    this.realRoot = fs.realpathSync(this.root);
  }

  resolve(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) throw new Error('args.path is required');
    const target = path.resolve(this.root, relativePath);
    if (!insideRoot(this.root, target)) throw new Error('PATH_OUTSIDE_ROOT');
    const ancestor = nearestExistingSync(target);
    if (!ancestor) throw new Error('PATH_UNRESOLVABLE');
    const realAncestor = fs.realpathSync(ancestor);
    if (!insideRoot(this.realRoot, realAncestor)) throw new Error('SYMLINK_OUTSIDE_ROOT');
    const projected = path.resolve(realAncestor, path.relative(ancestor, target));
    if (!insideRoot(this.realRoot, projected)) throw new Error('SYMLINK_OUTSIDE_ROOT');
    return target;
  }

  async snapshot(relativePath) {
    const target = this.resolve(relativePath);
    try {
      const info = await stat(target);
      if (!info.isFile()) return { exists: true, type: 'non-file' };
      const canonical = await realpath(target);
      if (!insideRoot(this.realRoot, canonical)) throw new Error('SYMLINK_OUTSIDE_ROOT');
      const content = await readFile(target, 'utf8');
      return { exists: true, type: 'file', content };
    } catch (error) {
      if (error?.code === 'ENOENT') return { exists: false };
      throw error;
    }
  }

  async execute(proposal) {
    const relativePath = proposal.args?.path;
    let target;
    try { target = this.resolve(relativePath); }
    catch (error) { return { ok: false, code: error.message, before: null, after: null }; }
    const before = await this.snapshot(relativePath);

    if (proposal.tool === 'fs.writeText') {
      if (typeof proposal.args?.text !== 'string') return { ok: false, code: 'INVALID_ARGUMENT', before, after: before };
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, proposal.args.text, 'utf8');
      return { ok: true, code: 'OK', before, after: await this.snapshot(relativePath) };
    }
    if (proposal.tool === 'fs.deleteFile') {
      try { await rm(target, { force: false }); }
      catch (error) { if (error?.code === 'ENOENT') return { ok: false, code: 'NOT_FOUND', before, after: before }; throw error; }
      return { ok: true, code: 'OK', before, after: await this.snapshot(relativePath) };
    }
    return { ok: false, code: 'UNKNOWN_TOOL', before, after: before };
  }
}
