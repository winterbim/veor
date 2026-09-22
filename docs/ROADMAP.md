# Roadmap

The roadmap is ordered by reduction of real execution risk, not feature count.

## 0.4 developer preview — current

Implemented and mechanically tested:

- deterministic monotonic authority;
- signed capability grants;
- one-shot Ed25519 review approval;
- separate signed execution receipts;
- portable default-deny MCP policy bundle;
- generic stdio MCP tool-call gateway;
- catalog drift detection;
- persistent evidence ledger + external head;
- symlink-aware filesystem boundaries;
- advisory provider that can only tighten decisions;
- standalone kernel stdio service;
- process execution with argv-only invocation, timeout and output cap;
- Linux Bubblewrap namespace backend when installed;
- explicit fail-closed `requireOsIsolation` mode;
- Cursor self-test configuration and continuation handoff;
- offline receipt verify CLI (`veor verify`) + `docs/PROOF.md`;
- `veor.policy/v1` schema contract (`schemas/policy-v1.schema.json` + `src/policy-schema.js`).

## P0 — beta boundary

- official MCP TypeScript SDK v2 transport targeting final 2026-07-28 protocol;
- draft-policy compiler from server catalog (untrusted draft until accepted);
- Bubblewrap hardening with seccomp/Landlock/cgroup adapters where available;
- secret broker and output redaction before persistence;
- remote receipt/ledger anchor interface (optional);
- revocation store for long-lived direct-runtime grants;
- explicit postcondition contract for proxied tools where adapters expose one.

## P1 — differentiation

- quorum/role approvals;
- transaction and rollback contracts;
- semantic output quarantine;
- gVisor/containerd adapter;
- microVM adapter;
- host integrations to reduce shell/filesystem bypass around VEOR.

## P2 — operator experience

- `veor init`;
- `veor doctor`;
- policy-diff review;
- approval TUI;
- signed release artifacts, SBOM and provenance;
- optional remote ledger anchor.

A milestone is not complete from implementation alone. Each security-relevant mechanism must ship with negative tests and a truthful documented boundary.
