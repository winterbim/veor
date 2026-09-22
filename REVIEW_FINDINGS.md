# Review Findings

Durable adversarial findings discovered while reviewing VEOR. Each finding should state what escaped the builder's first model and what future question would catch the same class earlier.

| Date | Class | Finding | Future challenge |
|---|---|---|---|
| 2026-09-22 | malformed probabilistic input | Out-of-range negative probabilities could have been treated as low risk by naive normalization. Fixed by mapping invalid probabilities to the conservative value `1`. | Are malformed or missing advisory values made safer or accidentally more permissive? |
| 2026-09-22 | unstable authorization binding | Runtime-generated proposal timestamps changed the digest after an external approval could have been signed. Fixed by keeping proposal content caller-stable; ledger time is recorded separately. | Does any verifier sign one representation while the executor later hashes a different representation? |
| 2026-09-22 | ledger tail truncation | A pure internal hash chain cannot detect removal of the final event. Added optional trusted-head verification and documented the need for an external anchor. | Can an attacker delete the tail while leaving every remaining link valid? |
| 2026-09-22 | ambiguous canonical representation | Non-JSON JavaScript objects could collapse to misleading digests or produce inconsistent signing semantics. Fixed by strict JSON-safe validation and null-prototype canonical objects. | Is every signed/hashed value represented unambiguously before authorization depends on it? |
