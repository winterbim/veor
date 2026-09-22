const RISK_VALUE = { low: 0.1, medium: 0.4, high: 0.75, critical: 1.0 };

export function buildPreflightQuestions() {
  return [
    {
      id: 'risk_band',
      type: 'choice',
      prompt: 'Overall operational risk if this tool action executes as proposed',
      options: ['low', 'medium', 'high', 'critical'],
    },
    {
      id: 'destructive',
      type: 'truth',
      prompt: 'The proposed action can destroy, overwrite, revoke, delete, publish, transfer, or irreversibly mutate valuable state',
    },
    {
      id: 'irreversible',
      type: 'truth',
      prompt: 'The proposed action is difficult to roll back completely',
    },
    {
      id: 'needs_human',
      type: 'truth',
      prompt: 'A human should review this specific action before execution',
    },
    {
      id: 'evidence_sufficiency',
      type: 'score',
      prompt: 'How sufficient is the available evidence for executing this exact action?',
      min: 0,
      max: 4,
    },
  ];
}

function validateConfidence(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

function conservativeProbability(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
}

export function normalizeReflex(result) {
  const answers = new Map((result?.answers ?? []).map((x) => [x.id, x]));
  const risk = answers.get('risk_band');
  const destructive = answers.get('destructive');
  const irreversible = answers.get('irreversible');
  const needsHuman = answers.get('needs_human');
  const evidence = answers.get('evidence_sufficiency');

  const riskBand = RISK_VALUE[risk?.answer] !== undefined ? risk.answer : 'critical';
  const evidenceScore = Number.isInteger(evidence?.value) ? Math.max(0, Math.min(4, evidence.value)) : 0;
  const confidences = [risk, destructive, irreversible, needsHuman, evidence]
    .filter(Boolean)
    .map((a) => validateConfidence(a.confidence));

  return {
    provider: result?.provider ?? { name: 'unknown', version: 'unknown' },
    riskBand,
    risk: RISK_VALUE[riskBand],
    destructiveProbability: conservativeProbability(destructive?.probability),
    irreversibleProbability: conservativeProbability(irreversible?.probability),
    humanReviewProbability: conservativeProbability(needsHuman?.probability),
    evidenceScore,
    minConfidence: confidences.length ? Math.min(...confidences) : 0,
    raw: result,
  };
}

export function routeForDeliberation(signals, {
  confidenceFloor = 0.7,
  riskFloor = 0.7,
  destructiveFloor = 0.65,
  irreversibleFloor = 0.65,
  evidenceFloor = 2,
} = {}) {
  const reasons = [];
  if (signals.minConfidence < confidenceFloor) reasons.push('LOW_CONFIDENCE');
  if (signals.risk >= riskFloor) reasons.push('HIGH_RISK');
  if (signals.destructiveProbability >= destructiveFloor) reasons.push('DESTRUCTIVE_SIGNAL');
  if (signals.irreversibleProbability >= irreversibleFloor) reasons.push('IRREVERSIBLE_SIGNAL');
  if (signals.evidenceScore < evidenceFloor) reasons.push('LOW_EVIDENCE');
  return { required: reasons.length > 0, reasons };
}

export class FunctionReflexProvider {
  constructor(fn, metadata = { name: 'function-provider', version: '1' }) {
    if (typeof fn !== 'function') throw new TypeError('fn must be a function');
    this.fn = fn;
    this.metadata = metadata;
  }

  async assess(proposal, questions) {
    const answers = await this.fn(proposal, questions);
    return { provider: this.metadata, answers };
  }
}
