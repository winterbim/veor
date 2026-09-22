# Engineering Doctrine

The repository is built under the same rules it enforces: claims are separated from proof, and proof is separated from review.

## Work levels

- **Architecture** — irreversible or structural choices; record alternatives, trade-offs and a rollback criterion.
- **Feature** — an end-to-end capability; prove a nominal path and at least one failure path.
- **Unit** — one invariant; write the failing or adversarial check first, implement minimally, execute the check, then refactor.
- **Patch** — one targeted change; perform one immediate concrete verification.

## Assurance profiles

- **Quick** — one local claim with a directly inspectable gate.
- **Guarded** — multi-step work; captured evidence plus a distinct review step for critical claims.
- **Assured** — high-impact changes; immutable evidence, clean source state, retained artifacts and external human sign-off where required.

## Rules

- The builder may assert a claim, but may not convert it into a reviewed truth merely because their command returned zero.
- A gate is named before implementation.
- A failing gate is evidence and is retained.
- The same gate failing twice triggers a scope audit before a third attempt.
- Parent work may only inherit what child work has actually proved.
- Repeated review findings become candidate rules, never automatic policy changes.

## Development closeout

Before calling a feature complete:

1. `npm run check`
2. run the concrete example exercising the feature
3. update `DEV_EVIDENCE.md` with exact commands and outcomes
4. perform an adversarial review pass against the evidence, not against the builder's explanation
5. record durable review findings in `REVIEW_FINDINGS.md`
