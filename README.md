# VEOR

**Verifiable Execution & Orchestration Runtime** — a governed execution boundary for AI agents.

VEOR is built around one rule:

> **A model may advise, but it may not manufacture authority.**

It sits between an agent and side-effecting tools and separates five concerns that are often collapsed into one LLM call:

```text
Agent / IDE / MCP client
          |
          v
  +-------------------+
  |   VEOR Gateway    |  protocol boundary / catalog fingerprint
  +---------+---------+
            |
            v
  +-------------------+
  | Decision Kernel   |  deterministic policy + capabilities
  +----+---------+----+
       |         |
 advisory       signed one-shot human approval
 tightens       (REVIEW only, never DENY)
       |         |
       +----+----+
            |
        ALLOW only
            |
            v
  +-------------------+
  | Sandbox / Tool    |  OS-aware execution backend
  +---------+---------+
            |
            v
  effect -> verification -> signed receipt -> tamper-evident ledger
```

## Current status

`0.4.0-dev.1` is a **developer preview**, not a production security certification.

The repository currently ships:

- deterministic `ALLOW < REVIEW < DENY` policy ordering;
- Ed25519 capability grants from the original runtime;
- proposal-bound independent approvals;
- **one-shot Ed25519 approval challenges with replay consumption**;
- strict canonical JSON before hashing/signing;
- persistent SHA-256 chained ledgers with an external head anchor;
- separately signed execution receipts;
- portable `veor.policy.json` bundles with default-deny MCP tool policy;
- bounded read/write roots with symlink-aware path checks;
- generic stdio MCP gateway that preserves downstream tools;
- catalog fingerprinting and drift detection;
- advisory-provider hook whose decisions are monotonic (it can only add friction);
- `veor_status`, `veor_preflight`, and `veor_receipts` MCP tools;
- a standalone decision-kernel stdio service;
- OS-backend detection for sandboxing;
- Linux Bubblewrap namespace plan when `bwrap` is installed;
- explicit process fallback that **does not pretend to be a sandbox**;
- argv-only execution, no shell interpolation;
- timeouts and bounded stdout/stderr;
- 39 executable tests in the current handoff.

## 60-second start

Requires Node.js 22+.

```bash
npm test
node src/cli.js sandbox-info
```

Start the included MCP self-test gateway:

```bash
VEOR_POLICY=./veor.policy.json \
VEOR_RUNTIME_DIR=./.veor/runtime \
VEOR_DOWNSTREAM_JSON='["node","examples/mcp/mock-server.js"]' \
node src/mcp/stdio.js
```

Or use the project-level `.cursor/mcp.json`: when this folder is opened in Cursor, the `veor-selftest` MCP server is already described there.

## Human approval

Create a separate approval keypair:

```bash
mkdir -p ~/.config/veor
node src/cli.js keygen approval \
  --private ~/.config/veor/approval-private.pem \
  --public ~/.config/veor/approval-public.pem
```

The gateway gets **only the public key**. When a call returns `REVIEW`, VEOR writes a challenge file. A human signs that exact challenge:

```bash
node src/cli.js approve /path/to/challenge.json \
  --private ~/.config/veor/approval-private.pem
```

Retrying the same call consumes the approval exactly once. A changed tool or changed arguments require a new approval. `DENY` is not overridable.

> For a real deployment, keep the approval private key outside the agent's trust domain (OS keychain helper, hardware key, mobile approval service, or a separate account/process). A key file readable by the same autonomous agent is not meaningful human separation.

## Signed receipts

Generate a distinct receipt identity:

```bash
node src/cli.js keygen receipt \
  --private ~/.config/veor/receipt-private.pem \
  --public ~/.config/veor/receipt-public.pem
```

When `VEOR_RECEIPT_PRIVATE_KEY` points to that private key, gateway receipts are Ed25519 signed independently of approval authority.

## Policy bundle

`veor.policy.json` is intentionally JSON so the core has zero third-party runtime dependencies.

```json
{
  "kind": "veor.policy/v1",
  "filesystem": {
    "readRoots": ["."],
    "writeRoots": [".veor/output"]
  },
  "mcp": {
    "denyUnknownTools": true,
    "requireAnnotations": true,
    "tools": {
      "filesystem.read_file": {
        "decision": "ALLOW",
        "readPathArgs": ["path"]
      },
      "filesystem.write_file": {
        "decision": "REVIEW",
        "writePathArgs": ["path"],
        "requireExplicitWritePath": true
      }
    }
  }
}
```

Unknown tools fail closed by default. MCP annotations are treated as hints, not authority. A project policy may always tighten them.

## Advisory / reflex decisions

Set `VEOR_ADVISORY_MODULE` to a local ESM module exporting:

```js
export function assess({ tool, args, policyDigest }) {
  return { decision: 'REVIEW', reasons: ['semantic-risk'] };
}
```

The provider may return `ALLOW`, `REVIEW`, or `DENY`, but the kernel combines it monotonically. An advisory `ALLOW` can never reduce deterministic `REVIEW` or `DENY`.

## Sandbox

Inspect available backends:

```bash
node src/cli.js sandbox-info
```

Execute an argv without a shell:

```bash
node src/cli.js sandbox --cwd "$PWD" -- node -e 'console.log("hello")'
```

If Bubblewrap is installed on Linux, `backend:auto` selects it. The current Bubblewrap backend uses namespaces, readonly system mounts, explicit read/write binds, a private `/tmp`, and network unsharing by default.

**Important:** the current developer preview does not yet ship a seccomp profile, Landlock rules, gVisor, or microVM backend. If `bwrap` is not available, VEOR falls back to `process` only when OS isolation is not required, and reports `osEnforced:false` in the receipt. Set `requireOsIsolation` for fail-closed behavior.

## MCP

The gateway currently provides a small dependency-free stdio JSON-RPC adapter suitable for testing legacy/current stdio MCP servers. It is deliberately not advertised as complete MCP 2026-07-28 conformance.

The next production milestone is an official MCP SDK v2 transport layer with explicit protocol-version negotiation and legacy adapters. See `CURSOR_HANDOFF.md`.

## Original runtime API

The original VEOR runtime remains available for direct embedding:

```js
import {
  createAuthority,
  issueGrant,
  PolicyKernel,
  VeorRuntime,
} from 'veor-runtime';
```

That path is useful when the application itself owns the executor and postcondition verifier.

## Security model

VEOR is not “AI that decides whether AI is safe.” Its intended chain is:

```text
probabilistic/semantic advice
        can only tighten
               |
               v
signed/deterministic authority
               |
               v
bounded effect surface
               |
               v
observable result
               |
               v
signed receipt + chained evidence
```

Read:

- `SECURITY.md`
- `docs/THREAT_MODEL.md`
- `docs/SECURITY_MATRIX.md`
- `CONSTITUTION.md`

before making security claims.

## Development

```bash
npm run check
npm run test:advanced
npm run demo:fs
npm run bench
```

The current full gate is **42/42 tests**. See `CURSOR_HANDOFF.md` for the exact next build sequence.

## License

MIT.
