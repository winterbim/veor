# VEOR 0.4.0-dev.4 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

Public repository: https://github.com/winterbim/veor

## What this tag contains

- Everything in 0.4.0-dev.3.
- Cursor shell hook in this repo is default-deny except single maintenance commands. A terminal outside Cursor is still uncovered.
- Bubblewrap seccomp filter: `sethostname` returns EPERM. `seccomp: true` only if the payload started.
- Landlock helper denies writes outside the granted directory when gcc and the kernel ABI exist.
- Official MCP SDK 1.30.0 stdio transport. Latest protocol it negotiates is 2025-11-25.
- Internal review: `docs/INTERNAL_SECURITY_REVIEW.md`. External review remains PENDING.

## Explicit non-claims

- Not an external audit.
- Not MCP 2026-07-28.
- Not a full syscall allowlist, gVisor, or microVM.
- Do not market as “production-safe”.

Show HN draft, for a human to post: `docs/SHOW_HN.md`.
