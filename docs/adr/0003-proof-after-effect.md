# ADR-0003: Execution and verification are distinct events

Status: accepted

## Context

A tool returning success proves only that the call completed according to its own contract. It does not prove the intended higher-level postcondition.

## Decision

Executors return an execution receipt. Verifiers separately evaluate an explicit postcondition. Both are stored in the evidence chain.

## Consequences

The API is slightly more verbose, but the runtime cannot silently equate exit status with truth.
