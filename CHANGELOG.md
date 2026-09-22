# Changelog

## 0.4.0-dev.3 — 2026-09-23

- Bubblewrap setup failures (including GitHub-hosted `RTM_NEWADDR` / loopback) keep `osEnforced: false`.

## 0.4.0-dev.2 — 2026-09-22

- self-dogfood: `policies/veor-self.json`, `npm run self`, Cursor MCP pointing at the self policy;
- signed non-executed receipts for DENY/REVIEW when receipt signing is configured;
- minimal zero-dep secret broker + self `secret_probe` (secret absent from receipts/logs);
- Bubblewrap reports `osEnforced: true` only after a successful `bwrap` spawn;
- repo host hook + `veor-gated-effect` wrapper (agent/npm surface; same-user shell still out of scope);
- CI runs `self` + `verify:self`; test gate 61/61.

## 0.4.0-dev.1 — 2026-09-22

- added portable default-deny MCP policy bundles;
- added one-shot Ed25519 approval store with replay consumption;
- added separate Ed25519 execution receipt signer;
- added persistent evidence ledger and external head verification;
- added MCP catalog fingerprint/drift guard;
- added generic stdio MCP execution gateway and VEOR introspection tools;
- added standalone decision-kernel stdio service;
- added advisory provider hook with monotonic authority semantics;
- added OS sandbox detection and Bubblewrap namespace backend;
- added explicit non-isolated process fallback and fail-closed isolation requirement;
- expanded full test gate to 42 tests;
- added Cursor handoff, repository rules and self-test MCP configuration.
