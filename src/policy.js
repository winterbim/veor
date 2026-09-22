import { verifyGrant, verifyApproval } from './grants.js';
import { hashObject } from './canonical.js';

export const Decision = Object.freeze({
  ALLOW: 'ALLOW',
  REVIEW: 'REVIEW',
  DENY: 'DENY',
});

const SEVERITY = { ALLOW: 0, REVIEW: 1, DENY: 2 };

export function tighten(current, candidate) {
  if (!(current in SEVERITY) || !(candidate in SEVERITY)) throw new Error('unknown decision');
  return SEVERITY[candidate] > SEVERITY[current] ? candidate : current;
}

function advisoryConstraint(signals, thresholds) {
  let decision = Decision.ALLOW;
  const reasons = [];

  const apply = (candidate, reason) => {
    decision = tighten(decision, candidate);
    reasons.push(reason);
  };

  if (signals.minConfidence < thresholds.confidenceFloor) apply(Decision.REVIEW, 'ADVISORY_LOW_CONFIDENCE');
  if (signals.evidenceScore < thresholds.evidenceFloor) apply(Decision.REVIEW, 'ADVISORY_LOW_EVIDENCE');
  if (signals.risk >= thresholds.riskReview) apply(Decision.REVIEW, 'ADVISORY_HIGH_RISK');
  if (signals.destructiveProbability >= thresholds.destructiveReview) apply(Decision.REVIEW, 'ADVISORY_DESTRUCTIVE');
  if (signals.irreversibleProbability >= thresholds.irreversibleReview) apply(Decision.REVIEW, 'ADVISORY_IRREVERSIBLE');
  if (signals.humanReviewProbability >= thresholds.humanReview) apply(Decision.REVIEW, 'ADVISORY_REQUESTS_HUMAN');

  if (
    signals.risk >= thresholds.riskDeny &&
    signals.destructiveProbability >= thresholds.destructiveDeny &&
    signals.irreversibleProbability >= thresholds.irreversibleDeny
  ) {
    apply(Decision.DENY, 'ADVISORY_EXTREME_COMPOUND_RISK');
  }

  return { decision, reasons };
}

export class PolicyKernel {
  constructor({
    authorityPublicKeyPem,
    requireDistinctReviewer = true,
    thresholds = {},
  }) {
    if (!authorityPublicKeyPem) throw new Error('authorityPublicKeyPem is required');
    this.publicKey = authorityPublicKeyPem;
    this.requireDistinctReviewer = requireDistinctReviewer;
    this.thresholds = {
      confidenceFloor: 0.7,
      evidenceFloor: 2,
      riskReview: 0.7,
      destructiveReview: 0.65,
      irreversibleReview: 0.65,
      humanReview: 0.65,
      riskDeny: 0.98,
      destructiveDeny: 0.98,
      irreversibleDeny: 0.98,
      ...thresholds,
    };
  }

  evaluate({ proposal, grantToken, signals, deepReview = null, approvalToken = null, now = new Date().toISOString() }) {
    const reasons = [];
    const grant = verifyGrant(this.publicKey, grantToken, {
      subject: proposal.subject,
      capability: proposal.capability,
      tool: proposal.tool,
      now,
    });

    if (!grant.valid) {
      return {
        decision: Decision.DENY,
        reasons: [`GRANT_${grant.reason}`],
        grant,
        advisory: { decision: Decision.ALLOW, reasons: [] },
        proposalDigest: hashObject(proposal),
      };
    }

    let decision = Decision.ALLOW;
    const advisory = advisoryConstraint(signals, this.thresholds);
    decision = tighten(decision, advisory.decision);
    reasons.push(...advisory.reasons);

    if (deepReview?.decision) {
      if (!(deepReview.decision in SEVERITY)) {
        decision = tighten(decision, Decision.REVIEW);
        reasons.push('DEEP_REVIEW_MALFORMED');
      } else {
        decision = tighten(decision, deepReview.decision);
        reasons.push(...(deepReview.reasons ?? []).map((r) => `DEEP_${r}`));
      }
    }

    const proposalDigest = hashObject(proposal);

    // A signed independent approval may resolve REVIEW, but never a DENY.
    // This is deterministic authority, not probabilistic evidence.
    if (decision === Decision.REVIEW && approvalToken) {
      const approval = verifyApproval(this.publicKey, approvalToken, {
        proposalDigest,
        proposerId: proposal.subject,
        now,
        requireDistinctReviewer: this.requireDistinctReviewer,
      });
      if (approval.valid) {
        decision = Decision.ALLOW;
        reasons.push('SIGNED_REVIEW_APPROVAL');
      } else {
        reasons.push(`APPROVAL_${approval.reason}`);
      }
    }

    return { decision, reasons, grant, advisory, proposalDigest };
  }
}
