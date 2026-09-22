import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, hashObject } from '../src/index.js';

test('canonical JSON is stable across object key order', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(hashObject({ b: 2, a: 1 }), hashObject({ a: 1, b: 2 }));
});

test('canonicalization rejects non-JSON values instead of silently collapsing them', () => {
  assert.throws(() => canonicalJson({ when: new Date() }), /plain JSON object/);
  assert.throws(() => canonicalJson({ bad: Number.NaN }), /non-finite/);
  assert.throws(() => canonicalJson({ missing: undefined }), /non-JSON/);
});

test('canonicalization safely preserves a literal __proto__ key', () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"a":1}');
  const output = canonicalJson(input);
  assert.match(output, /"__proto__"/);
  assert.equal({}.polluted, undefined);
});
