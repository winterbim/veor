const SENSITIVE_KEY = /(pass(word)?|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|client[_-]?secret)/i;

export function redact(value, { maxString = 240 } = {}, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > maxString ? value.slice(0, maxString) + '…' : value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => redact(v, { maxString }));
  if (typeof value === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(value).slice(0, 50)) out[k] = redact(v, { maxString }, k);
    return out;
  }
  return '[UNSUPPORTED]';
}
