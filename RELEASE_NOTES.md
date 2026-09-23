# VEOR 0.4.0-dev.6 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

## Install

```bash
npm install -g https://github.com/winterbim/veor/releases/download/v0.4.0-dev.6/veor-runtime-0.4.0-dev.6.tgz
veor sandbox-info
```

The tarball and `SHA256SUMS` are attached to this release. Check the sum before installing.

## What this tag contains

- Everything in 0.4.0-dev.5 (Linux, macOS, and Windows gate).
- A packed `veor-runtime` module a third party can install without cloning the repository.
- npmjs publication only when the `NPM_TOKEN` repository secret exists. This preview is not published as a stable `latest` by default.

## Explicit non-claims

- Not the same isolation strength on every OS. Windows reports `osEnforced: false`.
- Not production-safe.
- External review remains PENDING.
- Not on the npm `latest` tag unless a later publish says so.
