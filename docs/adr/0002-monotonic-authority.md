# ADR-0002: Probabilistic signals may only tighten authority

Status: accepted

## Context

Fast classifiers and language models can be useful for risk triage but are fallible, calibration-sensitive and vulnerable to context manipulation.

## Decision

All uncertain judgments are mapped to a severity constraint and composed with deterministic policy using `max(currentSeverity, advisorySeverity)`.

## Consequences

A high-confidence "safe" prediction never grants permission. A suspicious prediction can force review or denial. False positives reduce autonomy but do not increase privilege.

Revisit when: never for the core security invariant; only threshold mapping may evolve.
