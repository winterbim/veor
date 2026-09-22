# VEOR 0.4.0-dev.1 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

Public repository: https://github.com/winterbim/veor

## What this tag contains

- Deterministic execution authority separated from advisory/model judgment (`ALLOW < REVIEW < DENY`).
- Default-deny MCP policy bundles; unknown tools fail closed under the default profile.
- Hand-written stdio MCP gateway (`src/mcp/stdio.js`) with preflight/status/receipt inspection — **not** official MCP SDK v2 / 2026-07-28 conformance.
- Tool-catalog drift fingerprinting.
- One-shot Ed25519 approval challenges (exact-call bound, consumed once).
- Separate Ed25519 execution receipt signer.
- Persistent tamper-evident local ledger.
- Symlink-aware filesystem boundaries.
- Standalone decision-kernel stdio service.
- OS-aware sandbox abstraction (Bubblewrap when present) with truthful `osEnforced: false` process fallback.
- Live boundary demo: `npm run demo` (DENY / REVIEW / ALLOW+signed receipt).
- Gate: `npm run check` — 42 tests on Node ≥ 22.
- Cursor rules, MCP client templates, and `CURSOR_HANDOFF.md`.

## Explicit non-claims

- External security review: **PENDING** (`DEV_EVIDENCE.md`).
- Same-user bypass: an unrestricted shell/filesystem tool outside VEOR can bypass an MCP-only deployment.
- Host isolation: no seccomp/Landlock/gVisor/microVM in this build.
- Do not market as “production-safe”, “unbreakable”, or “complete sandbox” (`LAUNCH.md`, `SECURITY.md`).

See `CURSOR_HANDOFF.md` for P0 work before calling the project beta.
