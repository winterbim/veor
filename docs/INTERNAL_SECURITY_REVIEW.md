# Internal security review — 2026-09-23

This note is an internal pass over the developer preview. It is not an independent external audit. `DEV_EVIDENCE.md` still marks external review as PENDING.

## What was checked

- Decision monotonicity and unknown-tool fail-closed (existing tests, still green).
- Receipt digest and Ed25519 verification, including tamper.
- Secret broker: effect can see a secret; receipt and stderr must not.
- Host hook: shell commands in this repo now default-deny.
- Bubblewrap claims: `osEnforced` and `seccomp` stay false when setup fails.
- Official SDK pin `@modelcontextprotocol/sdk@1.30.0`: `SUPPORTED_PROTOCOL_VERSIONS` ends at `2025-11-25`. Version 1.25.2 carried a high advisory (cross-client data leak on a shared server/transport). 1.30.0 reports no npm advisories. The stdio process still builds one server and one transport.

## Findings

1. Same-user bypass remains for any shell that does not enter the Cursor hook. The hook cannot see a terminal, another IDE, or `ssh`. Documented in `docs/THREAT_MODEL.md`. Not closed.
2. The seccomp profile denies `sethostname` and allows every other syscall. It proves the filter is installed. It is not a general syscall allowlist.
3. Landlock allows read of `/` so the interpreter can start, and write only under `--rw` paths. It is not a container.
4. The official SDK dependency tree is no longer empty. `npm audit` is clean on 1.30.0. Do not describe VEOR as zero-dependency once this transport is installed.
5. No external reviewer signed this document.

## Not claimed

Production-safe. Certified. Unbypassable. MCP 2026-07-28 conformance.
