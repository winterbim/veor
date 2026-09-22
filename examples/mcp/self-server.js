#!/usr/bin/env node
/**
 * Downstream MCP server for VEOR self-dogfood.
 * Includes a secret_probe tool that reads a one-shot secret file (broker-fed)
 * and returns only digests / length — never the secret itself.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createInterface } from 'node:readline';

const marker = process.env.VEOR_MOCK_MARKER;
const secretSeenPath = process.env.VEOR_SECRET_SEEN_PATH;

const tools = [
  {
    name: 'filesystem.read_file',
    description: 'Read one file',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'filesystem.write_file',
    description: 'Write one file',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, text: { type: 'string' } },
      required: ['path', 'text'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'veor.self.secret_probe',
    description: 'Authorized effect that consumes a broker-injected secret without returning it',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'veor.self.delete',
    description: 'Destructive self tool (policy DENY)',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'surprise.delete_everything',
    description: 'Unknown dangerous tool',
    inputSchema: { type: 'object' },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
];

function send(v) {
  process.stdout.write(JSON.stringify(v) + '\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function runSecretProbe() {
  const secretFile = process.env.VEOR_EFFECT_SECRET_FILE;
  if (!secretFile || !fs.existsSync(secretFile)) {
    return {
      content: [{ type: 'text', text: 'secret unavailable' }],
      structuredContent: { sawSecret: false, reason: 'NO_SECRET_FILE' },
      isError: true,
    };
  }
  const secret = fs.readFileSync(secretFile, 'utf8');
  // Prove the effect saw the secret without embedding it in the MCP result.
  const proof = {
    sawSecret: secret.length > 0,
    secretLength: secret.length,
    secretSha256: sha256(secret),
  };
  if (secretSeenPath) {
    fs.writeFileSync(secretSeenPath, JSON.stringify(proof), { mode: 0o600 });
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(proof) }],
    structuredContent: proof,
    isError: false,
  };
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const m = JSON.parse(line);
  if (String(m.method || '').startsWith('notifications/')) return;
  if (m.method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        protocolVersion: m.params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'veor-self', version: '0.4.0' },
      },
    });
  }
  if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools } });
  if (m.method === 'tools/call') {
    const name = m.params?.name;
    if (marker) fs.appendFileSync(marker, name + '\n');
    if (name === 'veor.self.secret_probe') {
      return send({ jsonrpc: '2.0', id: m.id, result: runSecretProbe() });
    }
    if (name === 'filesystem.read_file') {
      const p = m.params?.arguments?.path;
      const text = typeof p === 'string' && fs.existsSync(p)
        ? fs.readFileSync(p, 'utf8').slice(0, 4000)
        : '';
      return send({
        jsonrpc: '2.0',
        id: m.id,
        result: {
          content: [{ type: 'text', text: text || 'executed' }],
          structuredContent: { name, bytes: text.length },
          isError: false,
        },
      });
    }
    return send({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        content: [{ type: 'text', text: 'executed' }],
        structuredContent: { name },
        isError: false,
      },
    });
  }
  return send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'unsupported' } });
});
