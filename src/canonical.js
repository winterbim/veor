import { createHash } from 'node:crypto';

export function assertJsonSafe(value, path = '$') {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return true;
  }
  if (type !== 'object') throw new TypeError(`${path} contains non-JSON value of type ${type}`);

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return true;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(`${path} must be a plain JSON object`);
  }
  for (const key of Object.keys(value)) {
    assertJsonSafe(value[key], `${path}.${key}`);
  }
  return true;
}

export function canonicalize(value) {
  assertJsonSafe(value);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);

  const out = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    out[key] = canonicalize(value[key]);
  }
  return out;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashObject(value) {
  return sha256(canonicalJson(value));
}
