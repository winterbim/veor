# Proof: what a VEOR receipt actually attests

This document describes only what the current code signs and verifies. It is not a security certification.

## Signed object

An execution receipt is produced by `ReceiptSigner.sign` (`src/security/receipt-signer.js`) as:

```text
{ body, signature, digest }
```

- `body.kind` is always `veor.execution-receipt/v1`.
- `digest` is `SHA-256(canonicalJson(body))` (`src/canonical.js`).
- `signature` is Ed25519 over the UTF-8 bytes of `canonicalJson(body)`, encoded base64url.
- Canonicalization sorts object keys recursively and rejects non-JSON values.

## Bytes covered by the signature

The signature covers the entire canonical JSON of `body`, including at least:

| Field | Meaning in this build |
|---|---|
| `kind` | Fixed receipt type string |
| `keyId` | Local key identifier string |
| `receiptId` | UUID for this receipt |
| `decidedAt` / `completedAt` | ISO timestamps from the decision/effect path |
| `tool` | Tool name that was decided |
| `argsDigest` | SHA-256 of canonical tool arguments (raw args are not embedded) |
| `decision` | Final decision string (`ALLOW` when an effect receipt is emitted by the gateway) |
| `executed` | Whether the gateway forwarded the call downstream |
| `verified` | Postcondition result when supplied; gateway currently passes `null` |
| `resultDigest` | SHA-256 of the downstream JSON-RPC result/error object |
| `sandbox` | Sandbox descriptor when supplied; gateway currently passes `null` |
| `policyDigest` | Digest of the active `veor.policy/v1` bundle |

Anything not present in `body` is not signed.

## Offline verification (`veor verify`)

```bash
node src/cli.js verify receipt <receipt.json> --public <receipt.pub.pem>
# alias: node src/cli.js receipt verify <receipt.json> --public <receipt.pub.pem>
# optional ledger binding: --ledger <ledger-dir>
```

`src/security/receipt-verify.js` checks, in order:

1. structure (`body`, `signature`, expected `kind`);
2. `digest === hashObject(body)` when `digest` is present;
3. Ed25519 verify of `canonicalJson(body)` against the supplied public key;
4. optional: `PersistentLedger.verify()` and that an identical receipt payload appears in a `receipt` event.

Exit code `0` only when all selected checks pass. Output is stable JSON (`kind: veor.receipt-verify/v1`).

Receipt verification is **replayable**: the same signed file verifies repeatedly. One-shot consumption applies to human approvals (`ApprovalStore.verifyAndConsume`), not to receipts.

## What this proves

Given a trusted receipt public key:

- the `body` bytes were signed by the corresponding private key;
- the digest matches the body;
- optionally, that exact signed receipt was appended into a locally intact hash-chained ledger.

## What this does **not** prove

- That the signer was a human, or that the private key was never readable by the agent.
- That the host blocked same-user bypass outside the VEOR gateway (`docs/THREAT_MODEL.md`).
- OS isolation when `sandbox` is `null` or when a process backend would report `osEnforced: false`.
- Semantic correctness of the tool effect (`verified` may be `null`).
- External security review (still **PENDING** in `DEV_EVIDENCE.md`).
- Complete MCP SDK / 2026-07-28 transport conformance.

## Related artefacts

- Live demo writes `evidence/current/demo-receipt.json` and `evidence/current/demo-receipt.pub.pem`.
- Policy contract: `schemas/policy-v1.schema.json` + executable `src/policy-schema.js`.
- Ledger chain: `src/security/persistent-ledger.js`.
