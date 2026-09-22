export class ScopeEscalationRequired extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ScopeEscalationRequired';
    this.code = 'SCOPE_ESCALATION_REQUIRED';
    this.details = details;
  }
}

export class FailureGuard {
  constructor({ maxIdenticalFailures = 2 } = {}) {
    this.maxIdenticalFailures = maxIdenticalFailures;
    this.failures = new Map();
  }

  #key(scope, gateFingerprint, planFingerprint) {
    return `${scope}\u0000${gateFingerprint}\u0000${planFingerprint}`;
  }

  assertMayAttempt({ scope, gateFingerprint, planFingerprint }) {
    const key = this.#key(scope, gateFingerprint, planFingerprint);
    const count = this.failures.get(key) ?? 0;
    if (count >= this.maxIdenticalFailures) {
      throw new ScopeEscalationRequired(
        `same gate failed ${count} times without a changed plan; escalation required`,
        { scope, gateFingerprint, planFingerprint, count },
      );
    }
    return true;
  }

  recordFailure({ scope, gateFingerprint, planFingerprint }) {
    const key = this.#key(scope, gateFingerprint, planFingerprint);
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    return count;
  }

  recordSuccess({ scope, gateFingerprint, planFingerprint }) {
    const key = this.#key(scope, gateFingerprint, planFingerprint);
    this.failures.delete(key);
  }
}
