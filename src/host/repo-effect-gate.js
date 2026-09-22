import { verifyReceipt } from '../security/receipt-verify.js';
import { hashObject } from '../canonical.js';

/**
 * Host-side gate for repo-routed effects.
 * Covers agent/MCP/npm-script surfaces that opt into this check.
 * Does NOT cover an unrestricted same-user shell that never calls this gate.
 */
export function gateRepoEffect({
  receipt = null,
  publicKeyPem = null,
  tool = null,
  args = undefined,
  requireExecuted = true,
} = {}) {
  const reasons = [];
  if (!publicKeyPem) {
    return { ok: false, permission: 'deny', reasons: ['MISSING_RECEIPT_PUBLIC_KEY'] };
  }
  if (!receipt?.body || !receipt?.signature) {
    return { ok: false, permission: 'deny', reasons: ['MISSING_VEOR_RECEIPT'] };
  }
  const verified = verifyReceipt(receipt, publicKeyPem);
  if (!verified.ok) {
    return {
      ok: false,
      permission: 'deny',
      reasons: ['INVALID_VEOR_RECEIPT', ...verified.reasons],
      verify: verified,
    };
  }
  if (tool != null && receipt.body.tool !== tool) {
    reasons.push('TOOL_MISMATCH');
  }
  if (args !== undefined) {
    const expected = hashObject(args);
    if (receipt.body.argsDigest !== expected) reasons.push('ARGS_DIGEST_MISMATCH');
  }
  if (receipt.body.decision !== 'ALLOW') reasons.push('DECISION_NOT_ALLOW');
  if (requireExecuted && receipt.body.executed !== true) reasons.push('EFFECT_NOT_EXECUTED');
  if (reasons.length) {
    return { ok: false, permission: 'deny', reasons, verify: verified };
  }
  return {
    ok: true,
    permission: 'allow',
    reasons: ['VEOR_RECEIPT_OK'],
    verify: verified,
    receiptId: receipt.body.receiptId ?? null,
  };
}

/** Cursor beforeShellExecution / beforeMCPExecution response helper. */
export function toHookResponse(gate) {
  if (gate.ok) return { permission: 'allow' };
  return {
    permission: 'deny',
    user_message: `VEOR host hook blocked this repo effect (${gate.reasons.join(', ')}).`,
    agent_message: `Route the effect through the VEOR gateway and supply a valid signed receipt. Reasons: ${gate.reasons.join(', ')}.`,
  };
}
