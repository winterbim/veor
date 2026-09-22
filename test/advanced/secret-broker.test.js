import test from 'node:test';
import assert from 'node:assert/strict';
import { SecretBroker } from '../../src/security/secret-broker.js';
import { generateReceiptAuthority, ReceiptSigner } from '../../src/security/receipt-signer.js';
import { hashObject } from '../../src/canonical.js';

test('secret broker exposes secret only inside authorized effect and never in receipt', () => {
  const broker = new SecretBroker();
  const secret = broker.loadEphemeral('demo');
  let saw = null;
  const effect = broker.withSecret('demo', (value) => {
    saw = value;
    return { ok: true, secretDigest: hashObject({ secret: value }), length: value.length };
  });
  assert.equal(saw, secret);
  assert.equal(effect.length, secret.length);
  assert.notEqual(effect.secretDigest, secret);

  const keys = generateReceiptAuthority();
  const signer = new ReceiptSigner({ privateKeyPem: keys.privateKeyPem });
  const receipt = signer.sign({
    tool: 'veor.self.secret_probe',
    decision: 'ALLOW',
    executed: true,
    resultDigest: hashObject(effect),
  });
  const blob = JSON.stringify(receipt);
  assert.equal(blob.includes(secret), false);
  assert.equal(ReceiptSigner.verify(keys.publicKeyPem, receipt), true);

  broker.clear('demo');
  assert.equal(broker.has('demo'), false);
  assert.throws(() => broker.withSecret('demo', () => 'x'), /not available/);
});

test('secret broker refuses effect results that embed the secret', () => {
  const broker = new SecretBroker();
  const secret = broker.loadEphemeral('x');
  assert.throws(() => broker.withSecret('x', (v) => v), /refuses to return the raw secret/);
  assert.throws(() => broker.withSecret('x', (v) => `token=${v}`), /embed the secret/);
  broker.clearAll();
  assert.ok(!secret || secret.length > 0);
});
