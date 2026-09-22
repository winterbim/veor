# VEOR 0.4.0-dev.1 — Cursor handoff build

This is a developer-preview handoff, not the recommended public 1.0 release.

Highlights:

- deterministic execution authority separated from advisory/model judgment;
- default-deny policy bundles for MCP;
- generic stdio MCP gateway with preflight/status/receipt inspection;
- tool-catalog drift fingerprinting;
- one-shot Ed25519 approval challenges;
- separate Ed25519 receipt signer;
- persistent tamper-evident local ledger;
- symlink-aware filesystem boundaries;
- standalone kernel service;
- OS-aware sandbox abstraction with Bubblewrap support when installed and truthful non-isolated fallback;
- Cursor rules, self-test MCP config and authoritative `CURSOR_HANDOFF.md`.

See `CURSOR_HANDOFF.md` for P0 work before calling the project beta.
