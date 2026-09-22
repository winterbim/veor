import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileSystemExecutor } from '../src/filesystem-executor.js';

test('filesystem executor writes inside root and reports before/after', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'veor-fs-'));
  const ex = new FileSystemExecutor({ root });
  const receipt = await ex.execute({ tool: 'fs.writeText', args: { path: 'a/b.txt', text: 'hello' } });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.before.exists, false);
  assert.equal(receipt.after.content, 'hello');
});

test('filesystem executor blocks path traversal', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'veor-fs-'));
  const ex = new FileSystemExecutor({ root });
  const receipt = await ex.execute({ tool: 'fs.writeText', args: { path: '../escape.txt', text: 'no' } });
  assert.equal(receipt.ok, false);
  assert.equal(receipt.code, 'PATH_OUTSIDE_ROOT');
});

test('filesystem executor blocks symlink escape', async () => {
  const fsSync = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), 'veor-root-'));
  const outside = fsSync.mkdtempSync(path.join(os.tmpdir(), 'veor-out-'));
  fsSync.symlinkSync(outside, path.join(root, 'escape'));
  const executor = new FileSystemExecutor({ root });
  const result = await executor.execute({ tool: 'fs.writeText', args: { path: 'escape/pwn.txt', text: 'x' } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SYMLINK_OUTSIDE_ROOT');
  assert.equal(fsSync.existsSync(path.join(outside, 'pwn.txt')), false);
});
