import { performance } from 'node:perf_hooks';
import {
  createAuthority,
  issueGrant,
  PolicyKernel,
} from '../src/index.js';

const authority = createAuthority();
const kernel = new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem });
const proposal = {
  subject: 'bench-agent', capability: 'workspace.write', tool: 'fs.writeText',
  objective: 'benchmark policy path', args: { path: 'x.txt', text: 'x' },
};
const token = issueGrant(authority.privateKeyPem, {
  subject: proposal.subject,
  capability: proposal.capability,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  constraints: { tools: [proposal.tool] },
});
const signals = {
  minConfidence: 0.99,
  evidenceScore: 4,
  risk: 0.1,
  destructiveProbability: 0.01,
  irreversibleProbability: 0.01,
  humanReviewProbability: 0.01,
};

for (let i = 0; i < 1000; i += 1) kernel.evaluate({ proposal, grantToken: token, signals });

const runs = Number(process.env.VEOR_BENCH_RUNS ?? 20_000);
const start = performance.now();
for (let i = 0; i < runs; i += 1) kernel.evaluate({ proposal, grantToken: token, signals });
const elapsedMs = performance.now() - start;

console.log(JSON.stringify({
  scope: 'deterministic policy path only',
  includes: ['Ed25519 grant verification', 'constraint checks', 'advisory thresholding', 'proposal hashing'],
  excludes: ['model inference', 'tool execution', 'network', 'disk persistence'],
  runs,
  elapsedMs: Number(elapsedMs.toFixed(3)),
  meanMicroseconds: Number(((elapsedMs * 1000) / runs).toFixed(3)),
  opsPerSecond: Math.round(runs / (elapsedMs / 1000)),
  runtime: process.version,
  platform: `${process.platform}/${process.arch}`,
  note: 'local self-benchmark; not third-party verified',
}, null, 2));
