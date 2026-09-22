# Public GitHub launch checklist

Companion to `LAUNCH.md` (claims) and `PUBLISH_CHECKLIST.md` (beta engineering gates).
This file is the **human day-J** list for making the repository shareable on GitHub.
VEOR remains a **developer preview** until P0 in `CURSOR_HANDOFF.md` is done.

**Repository:** https://github.com/winterbim/veor

## Already in the tree

- [x] `LICENSE` (MIT)
- [x] `.gitignore` (`node_modules/`, `.veor/`, `.env*`, logs)
- [x] `SECURITY.md`, threat model, security matrix
- [x] `npm run check` / `npm run demo` scripts
- [x] GitHub Actions CI (`.github/workflows/ci.yml`, Node 22)
- [x] Honest README (guarantees / non-guarantees)
- [x] Binaries: `veor`, `veor-mcp`, `veor-kernel` (local / after pack)

## Repository metadata

**URL:** https://github.com/winterbim/veor

**Description (≤ ~120 chars):**

> Governed execution boundary for AI agents: policy → one-shot approval → effect → signed receipt. Developer preview.

**Topics:**

`ai-agents` · `mcp` · `agent-security` · `authorization` · `ed25519` · `sandbox` · `tool-use` · `evidence` · `nodejs` · `policy`

**Homepage:** leave empty (no separate project site yet).

## Day-J actions

1. [x] Public GitHub repository exists: https://github.com/winterbim/veor
2. [x] Pushed `master` after local `npm run check && npm run demo` (42/42 + live DENY/REVIEW/ALLOW+receipt).
3. [x] Description + topics applied via `gh`; Issues enabled. Private vulnerability reporting: configure in GitHub Security settings if not already.
4. [x] Annotated tag/release `v0.4.0-dev.1` (prerelease) from `RELEASE_NOTES.md`.
5. [ ] Human distribution: post once in a relevant venue (MCP / agent-security community) with a link to `npm run demo` and an explicit non-claim: not production-certified; external review PENDING.

## Do not do on day J

- Buy or fake stars, accounts, download counters, or testimonials.
- Claim “production-safe”, full MCP 2026-07-28 conformance, or external security review.
- `npm publish` until `PUBLISH_CHECKLIST.md` beta gates are honestly green.
- Bundle approval/receipt private keys in examples or release artifacts.

## Local preflight (before the push)

```bash
npm ci || npm install
npm run check
npm run demo
npm pack --dry-run
node src/cli.js sandbox-info
```
