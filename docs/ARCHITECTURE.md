# Architecture

## 1. Scope

VEOR governs the transition from **intent** to **effect**. Its job is not to decide what an agent should ultimately want; its job is to ensure that any proposed effect passes through explicit judgment, deterministic authority and verifiable execution.

## 2. Six-stage pipeline

### 2.1 Proposal

An `ActionProposal` is a normalized, immutable description of the requested side effect:

- subject / actor
- capability
- tool name
- arguments
- objective
- reversibility hint
- timestamp

Arguments are canonicalized before hashing. Policy reasons about the normalized proposal, not a free-form prompt.

### 2.2 Reflex

The runtime compiles each proposal into a small batch of typed questions. The provider may be a local classifier, remote service or deterministic test double.

Supported primitives:

- `choice` — pick one member of a fixed option set;
- `score` — return a bounded ordinal value;
- `truth` — estimate a binary proposition.

Each answer includes probabilities or a confidence value. All answers are advisory.

### 2.3 Escalation / deliberation

A deterministic router requests deeper review when one or more of the following hold:

- confidence below the configured floor;
- high probability of destructive or irreversible behavior;
- evidence sufficiency below threshold;
- contradiction between advisory signals;
- explicit policy requirement.

The deep reviewer may add restrictions or request human review. It may not grant a capability.

### 2.4 Authority

The policy kernel is the only component allowed to return final `ALLOW`.

It checks:

1. a cryptographically valid capability grant exists;
2. the subject and capability match;
3. the grant is currently valid;
4. deterministic constraints match the proposal;
5. advisory signals do not require stricter handling;
6. a required human decision has been supplied and is valid.

The severity order is fixed:

```text
ALLOW < REVIEW < DENY
```

Every input may only keep or increase severity. No advisory source can lower it.

### 2.5 Effect

An executor receives an already-authorized action. The core package ships only a harmless in-memory executor. Real adapters must be separate packages so the trust boundary stays visible.

### 2.6 Proof

Execution success and claim truth are separate events. A verifier evaluates an explicit postcondition after the effect. The ledger records:

- proposal digest;
- advisory judgments;
- policy decision and reasons;
- grant identity;
- execution receipt;
- verification result;
- previous event hash and current event hash.

## 3. Authority monotonicity

This is VEOR's central invariant.

Let decision severity be ordered as:

`ALLOW = 0`, `REVIEW = 1`, `DENY = 2`.

For any new advisory input `a`, policy composition is:

`decision_next = max(decision_current, advisory_constraint(a))`

Therefore new uncertain information can make execution harder, never easier.

## 4. Failure escalation

VEOR tracks failures by `(scope, gateFingerprint)`. If the same gate fails twice without a changed plan fingerprint, a third identical attempt is rejected with `SCOPE_ESCALATION_REQUIRED`.

This prevents autonomous loops from spending resources repeating a failed action at the wrong abstraction level.

## 5. Learning without self-authorization

Review findings may be accumulated into a candidate-rule queue. Promotion into active policy is an explicit administrative action outside the inference path. The runtime never self-edits active authorization rules from model output.
