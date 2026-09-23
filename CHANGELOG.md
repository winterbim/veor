# Changelog

## 0.4.0-dev.6 — 2026-09-23

- Installable release tarball on the GitHub release. `npm ci` is required: the official MCP SDK is a runtime dependency.
- Tag push packs the module, writes SHA-256, and attaches both to the prerelease. npmjs publish runs only when `NPM_TOKEN` is set.

## 0.4.0-dev.5 — 2026-09-23

- The gate, demo, and self-check run on Linux, macOS, and Windows. CI is a matrix of those three.
- macOS isolation is Seatbelt (`sandbox-exec`). `osEnforced: true` only after it starts the payload.
- Windows has no OS-isolation backend in this build. Effects run, and the result says `osEnforced: false`.
- `npm run check` expands files in Node so the gate does not depend on a Unix shell.

## 0.4.0-dev.4 — 2026-09-23

- Cursor `beforeShellExecution` in this repo is default-deny except single maintenance commands. A terminal outside Cursor is still uncovered.
- Bubblewrap loads a seccomp filter that returns EPERM for `sethostname`. `seccomp: true` only after the payload starts.
- Landlock helper (`src/sandbox/landlock-exec.c`) restricts writes to granted directories when the kernel and gcc can build it.
- Official MCP SDK 1.30.0 stdio transport (`src/mcp/sdk-stdio.js`). Negotiated protocol is the SDK's own set, latest 2025-11-25, not 2026-07-28. 1.25.2 had a cross-client data-leak advisory; this pin audits clean.
- Internal security notes in `docs/INTERNAL_SECURITY_REVIEW.md`. External review remains PENDING.

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
