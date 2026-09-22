# Cursor Handoff — VEOR 0.4.0-dev.1

This file is the authoritative continuation point when opening the repository in Cursor.

## Current truth

- `npm run check` passes.
- Full test count at handoff: **42/42**.
- The repository is a developer preview, not production-certified software.
- The original direct runtime still works.
- New product surfaces are implemented under `src/kernel/`, `src/mcp/`, `src/security/`, `src/sandbox/` and `src/policy-bundle.js`.
- Do not rewrite the architecture into a monolith.

## Load-bearing invariants

1. Probabilistic/model output may only tighten: `ALLOW -> REVIEW -> DENY`.
2. Only deterministic authority can resolve `REVIEW` to `ALLOW`.
3. `DENY` is never overridable by an approval.
4. Human approval is exact-call-bound and one-shot.
5. Unknown MCP tools fail closed unless policy explicitly says otherwise.
6. Raw MCP arguments must not be copied into evidence records by default.
7. A successful process/tool call is not the same as a verified postcondition.
8. The reported sandbox level must describe the backend actually used; never label `process` as isolated.
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
- `veor_status`
- `veor_preflight`
- `veor_receipts`
- catalog drift fingerprint
- advisory hook

### Sandbox
- `src/sandbox/process-sandbox.js`
- `src/sandbox/bubblewrap-sandbox.js`
- automatic backend detection
- fail-closed `requireOsIsolation`
- network denied by default in Bubblewrap

### Crypto/evidence
- capability grants from v0.1
- one-shot approval authority
- separate receipt authority
- persistent hash-chain ledger + external head

## P0 — finish before calling it beta

### P0.1 Official MCP SDK v2 transport
Replace the hand-written external protocol surface with the official TypeScript MCP SDK v2 and explicitly target the final 2026-07-28 protocol. Keep the current stdio proxy as a `legacy-stdio` adapter. Required tests:
- initialize negotiation across supported versions;
- tools/list pagination/changes if exposed by SDK;
- notifications forwarding;
- cancellation;
- progress/logging passthrough;
- structured tool errors;
- transport shutdown behavior.

Do not change the kernel because of transport details.

### P0.2 Policy schema + compiler
Add `schemas/policy-v1.schema.json` and validate every bundle before construction. Add a compiler command that can inspect a server catalog and generate an **untrusted draft** policy. Draft inference must never become active authority without explicit acceptance.

### P0.3 Bubblewrap hardening
Current backend is namespace isolation, not a full hardened Linux sandbox. Add:
- tested minimal mount set;
- seccomp allow/deny profile or a documented integration with a mature seccomp provider;
- Landlock where available for defense in depth;
- rlimits / cgroup v2 budget adapter;
- child-process tree cleanup;
- DNS/network policy when network is enabled.

Do not invent a custom kernel isolation primitive.

### P0.4 Secret broker
Never inject broad host environment into agent tools. Add a broker interface where policy maps a tool/capability to named secret handles, and the executor materializes only the exact secrets required for the bounded child process. Redact secret values from stdout/stderr before persistence.

### P0.5 Receipt verification CLI
Add:
- `veor receipt verify <file> --public <key>`
- export of decision+effect receipts as a compact JSON bundle;
- optional remote anchor interface (Git transparency log / append-only object store / TSA adapter), without making the remote service mandatory.

## P1 — product differentiation

### Quorum approvals
Support `1-of-N`, `2-of-N`, and role-based reviewers. Preserve exact proposal binding. Never let quorum approve deterministic DENY.

### Transaction / rollback contracts
Allow tools to declare:
- precondition snapshot;
- reversible operation;
- rollback implementation;
- postcondition.
Record rollback ability in policy and receipt.

### Semantic data boundary
Add optional output inspection that may quarantine tool results before they are returned to the model. Use it for credentials, private keys, tokens, sensitive filesystem paths and prompt-injection-like content. This output classifier may quarantine/review; it must not forge “safe” authority.

### Strong isolation adapters
Add interfaces for gVisor/containerd and a microVM provider. A receipt must include backend identity and isolation evidence so users can distinguish namespace isolation from a VM boundary.

### IDE/host bypass reduction
VEOR controls only surfaces routed through it. Add documented host integrations/hooks for Cursor/Claude/Codex where available, so shell/MCP/filesystem actions can be forced through VEOR or explicitly denied by host policy.

## P2 — usability

- interactive TUI for pending approvals;
- policy diff review (`old -> new`);
- local web UI only after the CLI/security workflow is stable;
- `veor doctor` with platform/backend checks;
- `veor init` generating a minimal policy and Cursor config;
- signed release artifacts + SBOM + provenance.

## Suggested first Cursor prompt

Use this verbatim:

> Read `CURSOR_HANDOFF.md`, `CONSTITUTION.md`, `docs/SECURITY_MATRIX.md`, `SECURITY.md` and the current tests before changing code. Treat the 9 load-bearing invariants in `CURSOR_HANDOFF.md` as immutable unless a new ADR explicitly changes one. Start with P0.1: implement an official MCP SDK v2 transport adapter while retaining `src/mcp/gateway.js` as legacy stdio compatibility. Add tests first, keep the kernel transport-agnostic, run `npm run check`, and update the handoff only with claims proven by the gate.

## Final gate before any public release

```bash
npm ci || npm install
npm run check
npm pack --dry-run
node src/cli.js sandbox-info
```

If any security claim cannot be demonstrated by a test or by a clearly identified OS primitive, weaken the claim instead of strengthening the prose.
