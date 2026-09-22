# Development Evidence

This file separates executed gates from unverified claims. A green local gate is not an independent security audit.

## Current 0.4.0-dev.4 gate

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
| Host hook denies ordinary shell without a receipt; allows maintenance commands | host-hook tests | CAPTURED_PASS |
| Seccomp denies sethostname inside bubblewrap when the namespace actually starts | sandbox-hardening test | CAPTURED_PASS when bwrap can sethostname |
| Landlock helper denies writes outside the granted directory | sandbox-hardening test | CAPTURED_PASS when gcc and Landlock ABI exist |
| Official MCP SDK 1.30.0 stdio transport denies an unprofiled tool | sdk-gateway test | CAPTURED_PASS |
| Independent external security review | external reviewer | PENDING |
| MCP protocol 2026-07-28 | not in SDK 1.30.0 (latest negotiated: 2025-11-25) | NOT CLAIMED |
| Full syscall allowlist, gVisor, microVM | seccomp profile is sethostname-only | NOT CLAIMED |
| Full product secret-broker (cross-tool named handles) | broader than self-probe | PENDING |

Fresh raw artefacts for the handoff are generated under `evidence/current/` by `npm run demo` / `npm run self` (gitignored receipts).
