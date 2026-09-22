import test from 'node:test';
import assert from 'node:assert/strict';
import { FailureGuard, ScopeEscalationRequired } from '../src/index.js';

test('two identical failures block a third identical retry', () => {
  const guard = new FailureGuard();
  const loop = { scope: 'unit:parser', gateFingerprint: 'gate-A', planFingerprint: 'plan-1' };
  guard.assertMayAttempt(loop);
  guard.recordFailure(loop);
  guard.assertMayAttempt(loop);
  guard.recordFailure(loop);
  assert.throws(() => guard.assertMayAttempt(loop), ScopeEscalationRequired);
});

test('changing the plan fingerprint permits a genuinely different attempt', () => {
  const guard = new FailureGuard();
  const a = { scope: 'unit:parser', gateFingerprint: 'gate-A', planFingerprint: 'plan-1' };
  guard.recordFailure(a);
  guard.recordFailure(a);
  assert.doesNotThrow(() => guard.assertMayAttempt({ ...a, planFingerprint: 'plan-2' }));
});
