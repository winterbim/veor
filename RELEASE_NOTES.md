# VEOR 0.4.0-dev.2 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

Public repository: https://github.com/winterbim/veor

## What this tag contains

- Everything in 0.4.0-dev.1, plus VEOR self-dogfood as the reference proof path.
- `policies/veor-self.json` + `npm run self`: live gateway ALLOW + DENY receipts; `npm run verify:self` replays the ALLOW receipt.
- Minimal zero-dep secret broker used by the self `secret_probe` (secret never in receipt/logs).
- Bubblewrap `osEnforced: true` only after a successful `bwrap` spawn.
- Cursor MCP config + host hook covering gated agent/npm effects for this repo (same-user unrestricted shell still out of scope).
- Gate: `npm run check` — 61 tests on Node ≥ 22; CI also runs `demo`, `verify`, `self`, `verify:self`.

## Explicit non-claims

- External security review: **PENDING** (`DEV_EVIDENCE.md`) — not simulated.
- Same-user bypass: unrestricted shell outside the host hook is not covered.
- Host isolation: no seccomp/Landlock/gVisor/microVM in this build.
- Do not market as “production-safe”, “unbreakable”, or “complete sandbox” (`LAUNCH.md`, `SECURITY.md`).

See `CURSOR_HANDOFF.md` for remaining P0 work before calling the project beta.
