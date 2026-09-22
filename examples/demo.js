import {
  createAuthority,
  issueGrant,
  EvidenceLedger,
  FailureGuard,
  FunctionReflexProvider,
  InMemoryExecutor,
  PolicyKernel,
  VeorRuntime,
} from '../src/index.js';

const authority = createAuthority();
const ledger = new EvidenceLedger();
const executor = new InMemoryExecutor({ notes: ['keep me'] });

const reflexProvider = new FunctionReflexProvider(async (proposal) => {
  const risky = proposal.tool === 'notes.deleteAll';
  return [
    {
      id: 'risk_band', type: 'choice', answer: risky ? 'high' : 'low',
      confidence: 0.96,
      probabilities: risky ? { low: 0.01, medium: 0.04, high: 0.9, critical: 0.05 } : { low: 0.94, medium: 0.05, high: 0.01, critical: 0 },
    },
    { id: 'destructive', type: 'truth', probability: risky ? 0.96 : 0.02, confidence: 0.97 },
    { id: 'irreversible', type: 'truth', probability: risky ? 0.78 : 0.03, confidence: 0.9 },
    { id: 'needs_human', type: 'truth', probability: risky ? 0.91 : 0.05, confidence: 0.94 },
    { id: 'evidence_sufficiency', type: 'score', value: risky ? 2 : 4, confidence: 0.92 },
  ];
}, { name: 'demo-reflex', version: '1.0', calibration: 'illustrative-only' });

const policyKernel = new PolicyKernel({ authorityPublicKeyPem: authority.publicKeyPem });
const runtime = new VeorRuntime({
  reflexProvider,
  policyKernel,
  executor,
  ledger,
  failureGuard: new FailureGuard(),
});

const expiresAt = new Date(Date.now() + 60_000).toISOString();
const appendGrant = issueGrant(authority.privateKeyPem, {
  subject: 'agent-demo', capability: 'notes.write', expiresAt,
  constraints: { tools: ['notes.append'] },
});

const deleteGrant = issueGrant(authority.privateKeyPem, {
  subject: 'agent-demo', capability: 'notes.admin', expiresAt,
  constraints: { tools: ['notes.deleteAll'] },
});

const safe = await runtime.run({
  proposal: {
    subject: 'agent-demo',
    capability: 'notes.write',
    tool: 'notes.append',
    objective: 'Append an auditable note',
    args: { text: 'verified note' },
  },
  grantToken: appendGrant,
  verify: ({ after }) => after.notes.at(-1) === 'verified note',
});

const risky = await runtime.run({
  proposal: {
    subject: 'agent-demo',
    capability: 'notes.admin',
    tool: 'notes.deleteAll',
    objective: 'Delete every note',
    args: {},
  },
  grantToken: deleteGrant,
  verify: ({ after }) => after.notes.length === 0,
});

console.log(JSON.stringify({
  safe: { outcome: safe.outcome, executed: safe.executed, verified: safe.verified },
  risky: { outcome: risky.outcome, executed: risky.executed, reasons: risky.policy.reasons },
  finalState: executor.state,
  evidence: ledger.verifyChain(),
}, null, 2));
