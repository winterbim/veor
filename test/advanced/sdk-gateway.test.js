import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veor-sdk-'));
  const policy = path.join(dir, 'policy.json');
  fs.writeFileSync(policy, JSON.stringify({
    kind: 'veor.policy/v1',
    filesystem: { readRoots: [root], writeRoots: [dir] },
    mcp: {
      denyUnknownTools: true,
      tools: {
        'filesystem.read_file': { decision: 'ALLOW', readPathArgs: ['path'] },
      },
    },
  }));
  const child = spawn(process.execPath, [path.join(root, 'src/mcp/sdk-stdio.js')], {
    cwd: root,
    env: {
      ...process.env,
      VEOR_POLICY: policy,
      VEOR_RUNTIME_DIR: path.join(dir, 'rt'),
      VEOR_DOWNSTREAM_JSON: JSON.stringify([process.execPath, path.join(root, 'examples/mcp/mock-server.js')]),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let seq = 0;
  const pending = new Map();
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter(message);
    }
  });
  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 8000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return { child, rpc };
}

test('official SDK transport denies an unprofiled tool before downstream', async (t) => {
  const gateway = start();
  t.after(() => { try { gateway.child.kill('SIGTERM'); } catch { /* ignore */ } });
  const init = await gateway.rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'veor-sdk-test', version: '0.4.0-dev.4' },
  });
  assert.equal(init.result.serverInfo.name, 'veor-gateway');
  assert.ok(init.result.protocolVersion);
  gateway.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const denied = await gateway.rpc('tools/call', { name: 'surprise.delete_everything', arguments: {} });
  assert.equal(denied.result.isError, true);
  assert.equal(denied.result.structuredContent.veor.decision, 'DENY');
  assert.equal(denied.result.structuredContent.veor.executed, false);
});
