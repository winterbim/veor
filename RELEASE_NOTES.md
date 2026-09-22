# VEOR 0.4.0-dev.3 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

Public repository: https://github.com/winterbim/veor

## What this tag contains

- Everything in 0.4.0-dev.2.
- Bubblewrap `osEnforced` stays false when `bwrap` fails during setup (GitHub-hosted runners: `RTM_NEWADDR` / loopback). A payload that actually runs inside the namespace can still report `osEnforced: true`.
- MCP gateway process exits when the client closes stdin (also on `v0.4.0-dev.2`).

## Explicit non-claims

- External security review: **PENDING** (`DEV_EVIDENCE.md`) — not simulated.
- Same-user bypass: unrestricted shell outside the host hook is not covered.
- Host isolation: no seccomp/Landlock/gVisor/microVM in this build. Bubblewrap network unshare is best-effort and is not claimed when setup fails.
- Do not market as “production-safe”, “unbreakable”, or “complete sandbox” (`LAUNCH.md`, `SECURITY.md`).

See `CURSOR_HANDOFF.md` for remaining P0 work before calling the project beta.
