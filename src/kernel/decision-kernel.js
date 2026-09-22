import { randomUUID } from 'node:crypto';
import { Decision } from '../decision.js';
import { hashObject } from '../canonical.js';

export class DecisionKernel {
  constructor({ policy, approvals = null, ledger = null, receiptSigner = null }) {
    if (!policy) throw new Error('policy is required');
    this.policy = policy;
    this.approvals = approvals;
    this.ledger = ledger;
    this.receiptSigner = receiptSigner;
  }

  decide({ tool, args = {}, advisoryDecision = Decision.ALLOW, catalogFingerprint = null, allowApproval = true }) {
    let result = this.policy.evaluateTool({ tool, args, advisoryDecision, catalogFingerprint });
    let challenge = null;
    let approval = null;
    if (result.decision === Decision.REVIEW && allowApproval && this.approvals) {
      challenge = this.approvals.find(tool.name, args) ?? this.approvals.create({ tool: tool.name, args, reasons: result.reasons, scope: this.policy.digest });
      approval = this.approvals.verifyAndConsume(challenge);
      if (approval.ok) result = { ...result, decision: Decision.ALLOW, reasons: [...result.reasons, 'ONE_SHOT_APPROVAL'] };
    }
    const record = {
      at: new Date().toISOString(),
      tool: tool.name,
      argsDigest: hashObject(args),
      decision: result.decision,
      reasons: result.reasons,
      policyDigest: result.policyDigest,
      capability: result.capability,
      challengeId: challenge?.challengeId ?? null,
      approval: approval?.reason ?? null,
    };
    this.ledger?.append('decision', record);
    return { ...result, record, challenge };
  }

  receipt({ decisionRecord, resultDigest, executed, verified = null, sandbox = null }) {
    const receipt = {
      receiptId: randomUUID(),
      decidedAt: decisionRecord.at,
      completedAt: new Date().toISOString(),
      tool: decisionRecord.tool,
      argsDigest: decisionRecord.argsDigest,
      decision: decisionRecord.decision,
      executed: !!executed,
      verified,
      resultDigest,
      sandbox,
      policyDigest: decisionRecord.policyDigest,
    };
    const signed = this.receiptSigner ? this.receiptSigner.sign(receipt) : { body: receipt, signature: null, digest: hashObject(receipt) };
    this.ledger?.append('receipt', signed);
    return signed;
  }
}

