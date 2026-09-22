# VEOR Security Matrix — 0.4.0-dev.1

| Surface | Current mechanism | Current claim | Not yet claimed |
|---|---|---|---|
| Policy | deterministic `ALLOW/REVIEW/DENY`, default deny | fail-closed for unknown profiled MCP tools | formal policy-language verification |
| Semantic risk | pluggable advisory module | can only tighten authority | classifier correctness |
| Human approval | Ed25519, exact tool+args digest+scope+expiry, consumed once | replay-resistant within the approval store | hardware-backed signer / remote quorum |
| Capability grants | Ed25519 + validity window + tool binding | cryptographically bound direct-runtime capability | distributed revocation service |
| Evidence | SHA-256 chained JSONL + external head | detects event mutation, middle deletion, anchored tail truncation | public transparency log / remote anchoring |
| Receipts | separate Ed25519 signer | receipt authenticity when signer key is protected | remote timestamp authority |
| MCP catalog | canonical tool fingerprint persisted | detects downstream catalog drift | semantic proof that an unchanged schema has unchanged behavior |
| Filesystem policy | explicit read/write roots, realpath/symlink checks | blocks path escape covered by policy arguments | kernel-enforced filesystem controls without sandbox backend |
| Process execution | argv-only, timeout, output cap, env allowlist | avoids shell interpolation in VEOR runner | protection from a hostile process by itself |
| Bubblewrap | namespaces, private temp, readonly system mounts, explicit binds, net unshare | OS namespace isolation when installed and selected | seccomp/Landlock/gVisor/microVM in this build |
| Same-user hostile agent | gateway + policy | protects calls that cross VEOR | cannot stop bypass through an unrelated shell/tool unless host routes that surface through VEOR or OS isolation |
| Secrets | raw MCP args omitted from VEOR ledger | lowers accidental evidence leakage | secret broker / DLP engine / HSM storage |
