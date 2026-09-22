# Cursor Handoff — VEOR 0.4.0-dev.3

This file is the authoritative continuation point when opening the repository in Cursor.

## Current truth

- `npm run check` passes.
- Full test count at handoff update: **61/61**.
- The repository is a developer preview, not production-certified software.
- The original direct runtime still works.
- New product surfaces are implemented under `src/kernel/`, `src/mcp/`, `src/security/`, `src/sandbox/`, `src/host/` and `src/policy-bundle.js`.
- Self-dogfood: `policies/veor-self.json` + `npm run self` + `.cursor/mcp.json` + host hook.
- Do not rewrite the architecture into a monolith.

## Load-bearing invariants

1. Probabilistic/model output may only tighten: `ALLOW -> REVIEW -> DENY`.
2. Only deterministic authority can resolve `REVIEW` to `ALLOW`.
3. `DENY` is never overridable by an approval.
4. Human approval is exact-call-bound and one-shot.
5. Unknown MCP tools fail closed unless policy explicitly says otherwise.
6. Raw MCP arguments must not be copied into evidence records by default.
7. A successful process/tool call is not the same as a verified postcondition.
8. The reported sandbox level must describe the backend actually used; never label `process` as isolated; Bubblewrap may claim `osEnforced: true` only after a successful spawn.
9. Security documentation must never claim a mechanism that is not covered by executable code/tests.

## What is implemented

### Kernel / authority
- `src/kernel/decision-kernel.js`
- `src/kernel/service.js`
- `src/kernel/stdio.js`
- policy digest binding
- one-shot approval integration
- signed receipt integration

### MCP
- `src/mcp/gateway.js`
- `src/mcp/stdio.js`
- downstream `tools/list` passthrough
- `tools/call` interception
- `veor_status` / `veor_preflight` / `veor_receipts`
- catalog drift fingerprint
- advisory hook
- signed receipts on DENY/REVIEW (non-executed) when receipt key configured

### Sandbox
- `src/sandbox/process-sandbox.js`
- `src/sandbox/bubblewrap-sandbox.js`
- automatic backend detection
- fail-closed `requireOsIsolation`
- network denied by default in Bubblewrap
- honest per-exec `osEnforced`

### Crypto/evidence / secrets / host
- capability grants from v0.1
- one-shot approval authority
- separate receipt authority + offline verify
- persistent hash-chain ledger + external head
- `src/security/secret-broker.js` (minimal, self-probe)
- `src/host/repo-effect-gate.js` + `.cursor/hooks/`

## P0 — finish before calling it beta

### P0.1 Official MCP SDK v2 transport
Replace the hand-written external protocol surface with the official TypeScript MCP SDK v2 and explicitly target the final 2026-07-28 protocol. Keep the current stdio proxy as a `legacy-stdio` adapter.

### P0.2 Policy schema + compiler
Shipped: `schemas/policy-v1.schema.json` + zero-dep `src/policy-schema.js`.
Still open: draft-policy compiler from server catalog (untrusted draft only).

### P0.3 Bubblewrap hardening
Current backend is namespace isolation with honest `osEnforced`. Still open: seccomp, Landlock, cgroup budgets, DNS policy.

### P0.4 Secret broker
Minimal broker shipped for self-probe. Broader named-handle product surface still P0 before beta.

### P0.5 Receipt verification CLI
Shipped: `veor verify`, demo + self artefacts, `docs/PROOF.md`.
Still open: remote anchor interface.

## P1 — product differentiation

See `docs/ROADMAP.md`. Host bypass reduction for this repo: Cursor hook + gated-effect wrapper. Same-user unrestricted shell remains outside the guarantee (`docs/THREAT_MODEL.md`).

## Final gate before any public release

```bash
npm ci || npm install
npm run check
npm run demo && npm run verify
npm run self && npm run verify:self
npm pack --dry-run
node src/cli.js sandbox-info
```

If any security claim cannot be demonstrated by a test or by a clearly identified OS primitive, weaken the claim instead of strengthening the prose.
