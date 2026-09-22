# Development Evidence

This file separates executed gates from unverified claims. A green local gate is not an independent security audit.

## Current 0.4.0-dev.2 gate

| Claim | Gate | Current status |
|---|---|---|
| Complete source parses and executable tests pass on Node 22 | `npm run check` | CAPTURED_PASS (61/61) |
| Unknown profiled MCP tools fail closed | advanced policy/gateway tests | CAPTURED_PASS |
| Advisory `ALLOW` cannot weaken deterministic `REVIEW` | policy-bundle + policy-schema fixtures | CAPTURED_PASS |
| Policy schema rejects explicit weaken flags | `examples/fixtures/policy-illegal-weaken.json` | CAPTURED_PASS |
| One-shot approval is exact-call-bound and replay consumption works | approval-store tests | CAPTURED_PASS |
| Receipt signature detects body tampering | receipt test | CAPTURED_PASS |
| Offline third-party receipt verify (digest + Ed25519) | receipt-verify tests + `npm run verify` | CAPTURED_PASS |
| Persistent ledger detects anchored tail truncation | persistent-ledger test | CAPTURED_PASS |
| MCP write in `REVIEW` is stopped before downstream execution | gateway test + marker | CAPTURED_PASS |
| Symlink filesystem escape is rejected | filesystem executor test | CAPTURED_PASS |
| Process fallback identifies itself as non-isolated | sandbox test | CAPTURED_PASS |
| OS isolation can be required fail-closed | sandbox test + ProcessSandbox constructor | CAPTURED_PASS |
| Bubblewrap sets `osEnforced` only after successful spawn | sandbox test (when `bwrap` present) | CAPTURED_PASS |
| Catalog baseline detects changed tool surface | catalog-guard test | CAPTURED_PASS |
| Self-dogfood ALLOW+DENY receipts + offline verify + tamper fail | `npm run self` + `npm run verify:self` | CAPTURED_PASS |
| Secret broker: effect sees secret; receipt/logs do not | secret-broker tests + self secret_probe | CAPTURED_PASS |
| Host hook denies gated repo effect without valid receipt | host-hook tests (executed in CI) | CAPTURED_PASS |
| Independent external security review | external reviewer | PENDING |
| Official MCP 2026-07-28 SDK conformance | future P0.1 gate | PENDING |
| seccomp/Landlock/gVisor/microVM hardening | future P0.3/P1 gates | PENDING |
| Full product secret-broker (cross-tool named handles) | broader than self-probe | PENDING |

Fresh raw artefacts for the handoff are generated under `evidence/current/` by `npm run demo` / `npm run self` (gitignored receipts).
