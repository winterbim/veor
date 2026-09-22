# VEOR 0.4.0-dev.5 — developer preview

**Status:** developer preview · not a security certification · not production-safe.

## What this tag contains

- Everything in 0.4.0-dev.4.
- Linux, macOS, and Windows run the same gate: policy, gateway, demo, self-check, offline verify.
- macOS isolation is Seatbelt when `sandbox-exec` starts the payload.
- Windows reports `osEnforced: false`. There is no AppContainer backend in this build.

## Explicit non-claims

- Not the same isolation strength on every OS.
- Not production-safe.
- External review remains PENDING.
