#!/usr/bin/env node
/** Cross-platform syntax check + test gate. Globs are expanded in Node, not by the shell. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = [
  'src',
  'src/kernel',
  'src/mcp',
  'src/sandbox',
  'src/security',
  'src/host',
  'examples',
  'examples/mcp',
  'scripts',
  '.cursor/hooks',
];

const files = [];
for (const dir of roots) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.js')) files.push(path.join(dir, name));
  }
}

for (const file of files) {
  const checked = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (checked.status !== 0) process.exit(checked.status ?? 1);
}

const tested = spawnSync(process.execPath, ['--test'], { stdio: 'inherit' });
process.exit(tested.status ?? 1);
