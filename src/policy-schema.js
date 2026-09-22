import { Decision, DECISION_RANK } from './decision.js';

/**
 * Zero-dependency validator for veor.policy/v1.
 * Documents and enforces: advisory may only tighten via max(deterministic, advisory).
 * Any explicit field that would authorize weakening is rejected at load time.
 */
export const POLICY_KIND = 'veor.policy/v1';
export const DECISIONS = Object.freeze([Decision.ALLOW, Decision.REVIEW, Decision.DENY]);

/** Fields that would break monotonicity if present and truthy — always rejected. */
export const FORBIDDEN_WEAKEN_KEYS = Object.freeze([
  'advisoryMayWeaken',
  'advisoryCanWeaken',
  'advisoryCanUpgrade',
  'allowAdvisoryUpgrade',
  'advisoryOverride',
  'weakenOnAdvisory',
]);

export const POLICY_MONOTONE_RULE = Object.freeze({
  order: 'ALLOW < REVIEW < DENY',
  ranks: { ...DECISION_RANK },
  composition: 'decision = max(deterministic, advisory)',
  note: 'Advisory/reflex signals may raise severity; they must never lower it. No policy field may authorize weakening.',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(errors, path, message) {
  errors.push({ path, message });
}

function rejectWeakenKeys(obj, path, errors) {
  if (!isPlainObject(obj)) return;
  for (const key of FORBIDDEN_WEAKEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key]) {
      fail(errors, `${path}.${key}`, `forbidden: would allow advisory to weaken severity (${POLICY_MONOTONE_RULE.composition})`);
    }
  }
}

function assertStringArray(value, path, errors) {
  if (value == null) return;
  if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) {
    fail(errors, path, 'must be an array of strings');
  }
}

function validateToolRule(name, rule, errors) {
  const path = `mcp.tools.${name}`;
  if (!isPlainObject(rule)) {
    fail(errors, path, 'must be an object');
    return;
  }
  rejectWeakenKeys(rule, path, errors);
  if (rule.decision != null) {
    if (!DECISIONS.includes(rule.decision)) {
      fail(errors, `${path}.decision`, `must be one of ${DECISIONS.join('|')}`);
    }
  }
  assertStringArray(rule.readPathArgs, `${path}.readPathArgs`, errors);
  assertStringArray(rule.writePathArgs, `${path}.writePathArgs`, errors);
  assertStringArray(rule.reviewIfPresent, `${path}.reviewIfPresent`, errors);
  if (rule.capability != null && typeof rule.capability !== 'string') {
    fail(errors, `${path}.capability`, 'must be a string');
  }
  if (rule.requireExplicitWritePath != null && typeof rule.requireExplicitWritePath !== 'boolean') {
    fail(errors, `${path}.requireExplicitWritePath`, 'must be a boolean');
  }
}

/**
 * @returns {{ ok: boolean, errors: Array<{path:string,message:string}>, monotone: typeof POLICY_MONOTONE_RULE }}
 */
export function validatePolicyV1(raw) {
  const errors = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ path: '$', message: 'policy must be a plain object' }], monotone: POLICY_MONOTONE_RULE };
  }
  rejectWeakenKeys(raw, '$', errors);

  if (raw.kind !== POLICY_KIND) {
    fail(errors, 'kind', `must be ${POLICY_KIND}`);
  }
  if (raw.name != null && typeof raw.name !== 'string') {
    fail(errors, 'name', 'must be a string');
  }

  if (raw.filesystem != null) {
    if (!isPlainObject(raw.filesystem)) fail(errors, 'filesystem', 'must be an object');
    else {
      assertStringArray(raw.filesystem.readRoots, 'filesystem.readRoots', errors);
      assertStringArray(raw.filesystem.writeRoots, 'filesystem.writeRoots', errors);
    }
  }

  if (raw.mcp != null) {
    if (!isPlainObject(raw.mcp)) fail(errors, 'mcp', 'must be an object');
    else {
      rejectWeakenKeys(raw.mcp, 'mcp', errors);
      if (raw.mcp.denyUnknownTools != null && typeof raw.mcp.denyUnknownTools !== 'boolean') {
        fail(errors, 'mcp.denyUnknownTools', 'must be a boolean');
      }
      if (raw.mcp.requireAnnotations != null && typeof raw.mcp.requireAnnotations !== 'boolean') {
        fail(errors, 'mcp.requireAnnotations', 'must be a boolean');
      }
      if (raw.mcp.catalogFingerprint != null && typeof raw.mcp.catalogFingerprint !== 'string') {
        fail(errors, 'mcp.catalogFingerprint', 'must be a string');
      }
      if (raw.mcp.tools != null) {
        if (!isPlainObject(raw.mcp.tools)) fail(errors, 'mcp.tools', 'must be an object');
        else {
          for (const [name, rule] of Object.entries(raw.mcp.tools)) {
            validateToolRule(name, rule, errors);
          }
        }
      }
    }
  }

  if (raw.advisory != null) {
    if (!isPlainObject(raw.advisory)) fail(errors, 'advisory', 'must be an object');
    else rejectWeakenKeys(raw.advisory, 'advisory', errors);
  }

  if (raw.sandbox != null) {
    if (!isPlainObject(raw.sandbox)) fail(errors, 'sandbox', 'must be an object');
    else {
      const backend = raw.sandbox.backend;
      if (backend != null && !['auto', 'process', 'bubblewrap'].includes(backend)) {
        fail(errors, 'sandbox.backend', 'must be auto|process|bubblewrap');
      }
      if (raw.sandbox.network != null && !['deny', 'allow'].includes(raw.sandbox.network)) {
        fail(errors, 'sandbox.network', 'must be deny|allow');
      }
      if (raw.sandbox.requireOsIsolation != null && typeof raw.sandbox.requireOsIsolation !== 'boolean') {
        fail(errors, 'sandbox.requireOsIsolation', 'must be a boolean');
      }
    }
  }

  return { ok: errors.length === 0, errors, monotone: POLICY_MONOTONE_RULE };
}

export function assertPolicyV1(raw) {
  const result = validatePolicyV1(raw);
  if (!result.ok) {
    const detail = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`invalid veor.policy/v1: ${detail}`);
  }
  return result;
}
