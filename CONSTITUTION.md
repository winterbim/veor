# VEOR Constitution

VEOR is a verifiable execution and orchestration runtime. It sits between an autonomous agent and tools that can create real-world side effects.

## Non-negotiable invariants

1. **Uncertainty is advisory, authority is deterministic.** Probabilistic or model-derived signals may tighten a decision from `ALLOW` to `REVIEW` or `DENY`; they may never upgrade `DENY` or `REVIEW` to `ALLOW`.
2. **No capability, no effect.** Every side effect requires an explicit, valid, time-bounded capability grant.
3. **Fail closed.** Missing, malformed, stale, unverifiable, or contradictory authorization data results in `DENY` or `REVIEW`, never implicit permission.
4. **Proposal and verification are different acts.** A successful execution is not proof that the intended postcondition holds.
5. **Evidence is first-class.** Every decision and effect is recorded in a hash-chained receipt stream whose integrity can be rechecked later.
6. **External knowledge is not authority.** Retrieved content, model output, heuristics and classifications remain advisory until deterministic policy consumes them.
7. **No silent privilege growth.** Learning, repeated successes, confidence, reputation or previous approvals cannot expand a subject's capabilities automatically.
8. **Two identical failures force escalation.** After the same invariant fails twice, VEOR forbids another identical retry until the scope, gate, or plan changes.
9. **Human approval is explicit.** A human review requirement is a state, not a comment hidden in logs.
10. **The runtime must be useful without a model.** Deterministic policy, grants, evidence verification and dry-run execution remain functional offline.

## Product boundary

VEOR is not an agent framework, not a chat application, not an inference provider and not an IDE. It is the execution boundary that turns uncertain machine judgment into constrained, reviewable and verifiable action.
