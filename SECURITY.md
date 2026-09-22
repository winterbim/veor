# Security policy

VEOR is security-adjacent software. The current line is **0.4.x developer preview** and is not a security certification or hardened-host guarantee.

## Reporting a vulnerability

Do not publish working bypass details before a fix is available. Once the repository is public, use the configured private security-reporting channel.

A useful report includes the affected commit/version, a minimal reproduction, expected vs actual authority decision, whether an unauthorized side effect occurs, whether a receipt/ledger can be forged or hidden, and the effective sandbox backend.

## Critical classes

Treat these as critical design failures:

- deterministic `DENY` becomes executable;
- a model/advisory provider can create authority;
- one-shot approval can be replayed or rebound to changed arguments;
- unknown MCP tools execute under a default-deny policy;
- path policy can be escaped through traversal or symlink tricks;
- the product reports OS isolation when it actually used the process fallback;
- receipt signatures or ledger integrity verify after tampering;
- raw secrets are persisted into evidence contrary to the documented redaction boundary.

See `docs/SECURITY_MATRIX.md` for current claims and non-claims.
