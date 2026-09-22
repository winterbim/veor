import { buildPreflightQuestions, normalizeReflex, routeForDeliberation } from './reflex.js';
import { Decision } from './policy.js';
import { assertJsonSafe, hashObject } from './canonical.js';
import { verifyPostcondition } from './executor.js';

function validateProposal(proposal) {
  const required = ['subject', 'capability', 'tool', 'objective'];
  for (const field of required) {
    if (typeof proposal?.[field] !== 'string' || proposal[field].length === 0) {
      throw new Error(`proposal.${field} is required`);
    }
  }
  if (proposal.args !== undefined && (proposal.args === null || typeof proposal.args !== 'object' || Array.isArray(proposal.args))) {
    throw new Error('proposal.args must be an object');
  }
  assertJsonSafe(proposal.args ?? {}, 'proposal.args');
  return Object.freeze({
    ...structuredClone(proposal),
    args: structuredClone(proposal.args ?? {}),
  });
}

export class VeorRuntime {
  constructor({ reflexProvider, policyKernel, executor, ledger, deliberator = null, failureGuard = null }) {
    if (!reflexProvider || !policyKernel || !executor || !ledger) {
      throw new Error('reflexProvider, policyKernel, executor and ledger are required');
    }
    this.reflex = reflexProvider;
    this.policy = policyKernel;
    this.executor = executor;
    this.ledger = ledger;
    this.deliberator = deliberator;
    this.failureGuard = failureGuard;
  }

  async run({ proposal, grantToken, approvalToken = null, verify, loop = null }) {
    const normalized = validateProposal(proposal);
    const proposalDigest = hashObject(normalized);
    this.ledger.append('proposal', { proposalDigest, proposal: normalized });

    if (loop && this.failureGuard) this.failureGuard.assertMayAttempt(loop);

    const questions = buildPreflightQuestions(normalized);
    const reflexRaw = await this.reflex.assess(normalized, questions);
    const signals = normalizeReflex(reflexRaw);
    this.ledger.append('reflex', { proposalDigest, questions, signals });

    const route = routeForDeliberation(signals);
    let deepReview = null;
    if (route.required) {
      if (this.deliberator) {
        deepReview = await this.deliberator.review({ proposal: normalized, signals, route });
      } else {
        deepReview = { decision: Decision.REVIEW, reasons: ['DELIBERATION_REQUIRED_BUT_UNAVAILABLE'] };
      }
      this.ledger.append('deliberation', { proposalDigest, route, deepReview });
    }

    const policy = this.policy.evaluate({
      proposal: normalized,
      grantToken,
      signals,
      deepReview,
      approvalToken,
    });
    this.ledger.append('policy', { proposalDigest, decision: policy.decision, reasons: policy.reasons });

    if (policy.decision !== Decision.ALLOW) {
      if (loop && this.failureGuard) this.failureGuard.recordFailure(loop);
      return {
        outcome: policy.decision,
        executed: false,
        verified: false,
        proposalDigest,
        policy,
        signals,
        route,
        ledgerHead: this.ledger.verifyChain().head,
      };
    }

    const receipt = await this.executor.execute(normalized);
    this.ledger.append('effect', { proposalDigest, receipt });

    const verification = await verifyPostcondition(receipt, verify);
    this.ledger.append('verification', { proposalDigest, verification });

    if (loop && this.failureGuard) {
      if (receipt.ok && verification.verified) this.failureGuard.recordSuccess(loop);
      else this.failureGuard.recordFailure(loop);
    }

    return {
      outcome: receipt.ok && verification.verified ? 'VERIFIED' : 'EXECUTED_UNVERIFIED',
      executed: receipt.ok,
      verified: verification.verified,
      proposalDigest,
      policy,
      signals,
      route,
      receipt,
      verification,
      ledgerHead: this.ledger.verifyChain().head,
    };
  }
}
