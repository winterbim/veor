import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  AsyncFileLedgerAdapter,
  createAuthority,
  FileEvidenceLedger,
  FileSystemExecutor,
  FunctionReflexProvider,
  issueGrant,
  PolicyKernel,
  VeorRuntime,
} from '../src/index.js';

const workspace = await mkdtemp(path.join(os.tmpdir(), 'veor-demo-'));
const ledgerStore = new FileEvidenceLedger({ file: path.join(workspace, '.veor', 'ledger.jsonl') });
await ledgerStore.load();
const ledger = new AsyncFileLedgerAdapter(ledgerStore);
const executor = new FileSystemExecutor({ root: workspace });
const authority = createAuthority();

const reflexProvider = new FunctionReflexProvider(async (proposal) => {
  const destructive = proposal.tool === 'fs.deleteFile';
  return [
    { id: 'risk_band', type: 'choice', answer: destructive ? 'high' : 'low', confidence: 0.97 },
    { id: 'destructive', type: 'truth', probability: destructive ? 0.97 : 0.02, confidence: 0.97 },
    { id: 'irreversible', type: 'truth', probability: destructive ? 0.78 : 0.03, confidence: 0.92 },
    { id: 'needs_human', type: 'truth', probability: destructive ? 0.93 : 0.05, confidence: 0.95 },
    { id: 'evidence_sufficiency', type: 'score', value: destructive ? 2 : 4, confidence: 0.94 },
  ];
}, { name: 'reference-demo-provider', version: '1', calibration: 'illustrative-only' });

const runtime = new VeorRuntime({
  reflexProvider,
  policyKernel: new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem }),
  executor,
  ledger,
});

const expiresAt = new Date(Date.now() + 60_000).toISOString();
const writeGrant = issueGrant(authority.privateKeyPem, {
  subject: 'demo-agent', capability: 'workspace.write', expiresAt,
  constraints: { tools: ['fs.writeText'] },
});
const deleteGrant = issueGrant(authority.privateKeyPem, {
  subject: 'demo-agent', capability: 'workspace.delete', expiresAt,
  constraints: { tools: ['fs.deleteFile'] },
});

const write = await runtime.run({
  proposal: {
    subject: 'demo-agent', capability: 'workspace.write', tool: 'fs.writeText',
    objective: 'Create a launch proof file', args: { path: 'proof.txt', text: 'VEOR executed this effect.\n' },
  },
  grantToken: writeGrant,
  verify: ({ after }) => after?.exists === true && after.content === 'VEOR executed this effect.\n',
});

const remove = await runtime.run({
  proposal: {
    subject: 'demo-agent', capability: 'workspace.delete', tool: 'fs.deleteFile',
    objective: 'Delete the proof file', args: { path: 'proof.txt' },
  },
  grantToken: deleteGrant,
  verify: ({ after }) => after?.exists === false,
});

await ledger.flush();
const headCheck = await ledgerStore.verifyPersistedHead();
const contentStillThere = await readFile(path.join(workspace, 'proof.txt'), 'utf8');

console.log(JSON.stringify({
  workspace,
  write: { outcome: write.outcome, executed: write.executed, verified: write.verified },
  deleteAttempt: { outcome: remove.outcome, executed: remove.executed, reasons: remove.policy.reasons },
  protectedFileStillExists: contentStillThere.trim(),
  ledger: { file: ledgerStore.file, headFile: ledgerStore.headFile, verification: headCheck },
}, null, 2));
