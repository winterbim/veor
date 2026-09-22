# Development Evidence

This file separates executed gates from unverified claims. A green local gate is not an independent security audit.

## Current 0.4.0-dev.1 gate

| Claim | Gate | Current status |
|---|---|---|
| Complete source parses and executable tests pass on Node 22 | `npm run check` | CAPTURED_PASS |
| Unknown profiled MCP tools fail closed | advanced policy/gateway tests | CAPTURED_PASS |
| Advisory `ALLOW` cannot weaken deterministic `REVIEW` | policy-bundle test | CAPTURED_PASS |
| One-shot approval is exact-call-bound and replay consumption works | approval-store tests | CAPTURED_PASS |
| Receipt signature detects body tampering | receipt test | CAPTURED_PASS |
| Persistent ledger detects anchored tail truncation | persistent-ledger test | CAPTURED_PASS |
| MCP write in `REVIEW` is stopped before downstream execution | gateway test + marker | CAPTURED_PASS |
| Symlink filesystem escape is rejected | filesystem executor test | CAPTURED_PASS |
| Process fallback identifies itself as non-isolated | sandbox test | CAPTURED_PASS |
| OS isolation can be required fail-closed | sandbox test | CAPTURED_PASS |
| Catalog baseline detects changed tool surface | catalog-guard test | CAPTURED_PASS |
| Independent external security review | external reviewer | PENDING |
| Official MCP 2026-07-28 SDK conformance | future P0.1 gate | PENDING |
| seccomp/Landlock/gVisor/microVM hardening | future P0.3/P1 gates | PENDING |

Fresh raw output for the handoff is stored under `evidence/current/`.
