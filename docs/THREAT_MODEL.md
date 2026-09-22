# Threat Model

## Protected assets

- the right to invoke side-effecting tools;
- grant/approval/receipt signing keys;
- policy bundles and catalog baselines;
- execution arguments and secrets;
- filesystem/network boundaries;
- evidence and receipt integrity;
- human review decisions.

## Adversaries and failure modes

### Confident or manipulated model output
Model/advisory output is not authority. It may only tighten an existing deterministic result.

### Prompt/retrieval injection
Free-form content is never interpreted as a capability. For MCP, unknown tools fail closed under the default policy. Future output-quarantine work remains necessary for hostile tool responses.

### Approval forgery or replay
One-shot approvals are Ed25519 signed over challenge ID, tool name, canonical argument digest, scope and expiry. Successful use is recorded and consumed. This protects replay in the local approval store; it does not prove the signer was a human if the autonomous agent can read the private key.

### Grant forgery
Direct-runtime grants use Ed25519 signatures, subject/capability/tool binding and validity windows. Long-lived distributed revocation is not complete in this preview.

### Path escape
Policy and the direct filesystem executor use canonical/realpath checks so lexical traversal and symlink escape are rejected in tested cases.

### MCP server drift
The downstream tool catalog is fingerprinted. Drift is visible and can tighten policy. An unchanged schema does not prove unchanged downstream behavior.

### Execution success mistaken for correctness
The embedded runtime keeps execution and postcondition verification separate. Generic MCP proxy receipts currently attest what crossed the boundary and what returned; tool-specific postcondition verification requires an adapter contract and remains P0 work.

### Evidence tampering
The persistent ledger hashes each event against its predecessor and writes an external local head. This detects retained-event mutation, middle deletion and anchored tail truncation. An attacker able to replace both ledger and anchor is outside the local-only guarantee; remote anchoring is planned.

### Hostile child process
The process fallback is explicitly non-isolated. On Linux, Bubblewrap can provide namespace/filesystem/network isolation when installed. The preview does not yet include a seccomp profile, Landlock rules, gVisor or microVM backend.

### Same-user bypass
VEOR only controls actions routed through it. A coding agent with a separate unrestricted shell or filesystem tool can bypass an MCP-only deployment. Host policy/hooks or OS isolation are required to reduce that bypass.

## Explicit non-claims

VEOR 0.4 developer preview does **not** claim:

- isolation from a compromised host;
- complete protection against same-user bypass;
- secure remote attestation;
- HSM-grade key storage;
- full MCP 2026-07-28 conformance yet;
- classifier correctness;
- regulatory certification;
- public transparency logging;
- full DLP/secret-broker protection;
- semantic correctness of every side effect.
