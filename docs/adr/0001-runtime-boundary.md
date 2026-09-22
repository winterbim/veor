# ADR-0001: VEOR is an execution boundary, not an agent framework

Status: accepted

## Context

The ecosystem already contains many agent frameworks, orchestration engines and policy gateways. A broad framework would duplicate mature surfaces and obscure the trust boundary.

## Decision

VEOR only governs the transition from proposed action to executed effect. Agent prompting, planning UI, memory UX and workflow authoring remain outside the core.

## Consequences

Positive: a small auditable core and framework independence.

Negative: VEOR depends on adapters for useful real-world execution and will not provide an all-in-one developer experience in v0.1.

Revisit when: three independent integrations require the same missing orchestration primitive inside the core.
