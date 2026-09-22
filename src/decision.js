export const Decision = Object.freeze({ ALLOW: 'ALLOW', REVIEW: 'REVIEW', DENY: 'DENY' });
export const DECISION_RANK = Object.freeze({ ALLOW: 0, REVIEW: 1, DENY: 2 });

export function tighten(...decisions) {
  let winner = Decision.ALLOW;
  for (const decision of decisions.flat()) {
    if (!decision) continue;
    if (!(decision in DECISION_RANK)) throw new Error(`unknown decision: ${decision}`);
    if (DECISION_RANK[decision] > DECISION_RANK[winner]) winner = decision;
  }
  return winner;
}
