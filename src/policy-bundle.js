import fs from 'node:fs';
import path from 'node:path';
import { Decision, tighten } from './decision.js';
import { hashObject } from './canonical.js';
import { assertPolicyV1 } from './policy-schema.js';

function arr(value) { return Array.isArray(value) ? value : []; }
function resolveRoots(values, baseDir) { return arr(values).map(v => path.resolve(baseDir, v)); }
function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function nearestExisting(candidate) {
  let cur = path.resolve(candidate);
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return cur;
}
function pathAllowed(candidate, roots, { mustExist = false } = {}) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const resolved = path.resolve(candidate);
  if (mustExist && !fs.existsSync(resolved)) return false;
  for (const root of roots) {
    const rr = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
    if (fs.existsSync(resolved)) {
      if (inside(rr, fs.realpathSync(resolved))) return true;
      continue;
    }
    const ancestor = nearestExisting(resolved);
    if (!ancestor) continue;
    const ra = fs.realpathSync(ancestor);
    if (!inside(rr, ra)) continue;
    const projected = path.resolve(ra, path.relative(ancestor, resolved));
    if (inside(rr, projected)) return true;
  }
  return false;
}

export class PolicyBundle {
  constructor(raw, { baseDir = process.cwd() } = {}) {
    assertPolicyV1(raw);
    this.raw = structuredClone(raw);
    this.baseDir = path.resolve(baseDir);
    this.readRoots = resolveRoots(raw.filesystem?.readRoots ?? ['.'], this.baseDir);
    this.writeRoots = resolveRoots(raw.filesystem?.writeRoots ?? ['.veor/output'], this.baseDir);
    this.denyUnknownTools = raw.mcp?.denyUnknownTools !== false;
    this.tools = raw.mcp?.tools ?? {};
    this.catalogFingerprint = raw.mcp?.catalogFingerprint ?? null;
    this.digest = hashObject(this.raw);
  }
  static load(file) {
    const resolved = path.resolve(file);
    return new PolicyBundle(JSON.parse(fs.readFileSync(resolved, 'utf8')), { baseDir: path.dirname(resolved) });
  }

  ruleFor(name) { return this.tools[name] ?? null; }

  evaluateTool({ tool, args = {}, advisoryDecision = Decision.ALLOW, catalogFingerprint = null }) {
    const rule = this.ruleFor(tool.name);
    const reasons = [];
    let decision = Decision.ALLOW;
    if (!rule && this.denyUnknownTools) {
      decision = Decision.DENY;
      reasons.push('UNKNOWN_TOOL');
    }
    if (this.catalogFingerprint && catalogFingerprint && this.catalogFingerprint !== catalogFingerprint) {
      decision = tighten(decision, Decision.REVIEW);
      reasons.push('CATALOG_DRIFT');
    }
    if (tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true) {
      decision = tighten(decision, Decision.REVIEW);
      reasons.push('MCP_SIDE_EFFECT_HINT');
    }
    if (!tool.annotations && this.raw.mcp?.requireAnnotations !== false) {
      decision = tighten(decision, Decision.REVIEW);
      reasons.push('MISSING_TOOL_ANNOTATIONS');
    }
    if (rule?.decision) {
      decision = tighten(decision, rule.decision);
      reasons.push(`POLICY_${rule.decision}`);
    }
    for (const field of arr(rule?.readPathArgs)) {
      if (args[field] == null) continue;
      if (!pathAllowed(String(args[field]), this.readRoots, { mustExist: true })) {
        decision = Decision.DENY; reasons.push(`READ_PATH_DENIED:${field}`);
      }
    }
    for (const field of arr(rule?.writePathArgs)) {
      if (args[field] == null) {
        if (rule.requireExplicitWritePath) { decision = Decision.DENY; reasons.push(`WRITE_PATH_REQUIRED:${field}`); }
        continue;
      }
      if (!pathAllowed(String(args[field]), this.writeRoots)) {
        decision = Decision.DENY; reasons.push(`WRITE_PATH_DENIED:${field}`);
      }
    }
    for (const field of arr(rule?.reviewIfPresent)) {
      if (args[field] != null) { decision = tighten(decision, Decision.REVIEW); reasons.push(`ARG_REQUIRES_REVIEW:${field}`); }
    }
    decision = tighten(decision, advisoryDecision);
    if (advisoryDecision !== Decision.ALLOW) reasons.push(`ADVISORY_${advisoryDecision}`);
    return { decision, reasons, policyDigest: this.digest, capability: rule?.capability ?? `mcp.tool.${tool.name}` };
  }
}
