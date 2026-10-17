import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { authenticate, issueChallenge } from '../src/lib/auth.ts';
import { accessMessage, CHALLENGE_LIFETIME_MS, type Challenge } from '../src/lib/messages.ts';
import type { ChallengeStore } from '../src/lib/challenge-store.ts';
import { requestOrigin, readAuthBody, authFailure } from '../src/lib/auth-http.ts';
import { GatewayError } from '../src/lib/feedback.ts';

// A test double only. Deployable code has no in-memory fallback.
class TestStore implements ChallengeStore {
  records = new Map<string, Challenge>();
  async create(c: Challenge) { this.records.set(c.nonce, structuredClone(c)); }
  async get(nonce: string) { return this.records.get(nonce) ?? null; }
  async consume(c: Challenge) {
    if (JSON.stringify(this.records.get(c.nonce)) !== JSON.stringify(c)) return false;
    return this.records.delete(c.nonce);
  }
}
const origin = 'https://accesslease.example';
const key = '0x' + 'ab'.repeat(32);
const now = 1_797_000_000_000;
const account = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const binding = { key, resource: 'vault-demo' as const, subject: account.address };
const code = (expected: string) => (e: unknown) => e instanceof GatewayError && e.code === expected;
async function fixture(time = now) {
  const store = new TestStore();
  const c = await issueChallenge(binding, origin, store, time);
  const signature = await account.signMessage({ message: accessMessage(c) });
  const body = { ...binding, nonce: c.nonce, signature };
  return { store, c, body };
}
test('server nonce is unpredictable and challenge binds the full audience and scope', async () => {
  const a = await fixture();
  const b = await fixture();
  assert.match(a.c.nonce, /^[a-f0-9]{64}$/);
  assert.notEqual(a.c.nonce, b.c.nonce);
  assert.equal(a.c.expiresAtMs - a.c.issuedAtMs, CHALLENGE_LIFETIME_MS);
  for (const field of [origin, key, a.c.subject, a.c.nonce, 'vault-demo', new Date(now).toISOString()]) assert.ok(accessMessage(a.c).includes(field));
});
test('valid challenge signature recovers and authenticates the intended recipient', async () => {
  const { store, c, body } = await fixture();
  assert.deepEqual(await authenticate(body, origin, store, () => now + 60_000), c);
});
test('expired challenge and exact deadline are denied', async () => {
  for (const delta of [CHALLENGE_LIFETIME_MS, CHALLENGE_LIFETIME_MS + 1]) {
    const { store, body } = await fixture();
    await assert.rejects(authenticate(body, origin, store, () => now + delta), code('challenge_expired'));
  }
});
test('future-issued challenge is denied', async () => {
  const { store, body } = await fixture(now + 1);
  await assert.rejects(authenticate(body, origin, store, () => now), code('challenge_expired'));
});
test('invalid signature and wrong signing wallet are denied without consuming nonce', async () => {
  const { store, c, body } = await fixture();
  const wrongSignature = await stranger.signMessage({ message: accessMessage(c) });
  for (const signature of [wrongSignature, '0x' + '00'.repeat(65)]) {
    await assert.rejects(authenticate({ ...body, signature }, origin, store, () => now), code('invalid_signature'));
    assert.ok(await store.get(c.nonce));
  }
});
test('replayed challenge is denied', async () => {
  const { store, body } = await fixture();
  await authenticate(body, origin, store, () => now);
  await assert.rejects(authenticate(body, origin, store, () => now), code('challenge_used'));
});
test('two concurrent submissions yield exactly one successful consumption', async () => {
  const { store, body } = await fixture();
  const outcomes = await Promise.allSettled([authenticate(body, origin, store, () => now), authenticate(body, origin, store, () => now)]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(o => o.status === 'rejected').length, 1);
});
for (const [name, change, expected] of [
  ['wallet binding', { subject: stranger.address }, 'subject_mismatch'],
  ['resource binding', { resource: 'analytics-demo' }, 'resource_mismatch'],
  ['lease binding', { key: '0x' + 'cd'.repeat(32) }, 'lease_mismatch'],
] as const) test(name + ' cannot be changed on a captured signature', async () => {
  const { store, body } = await fixture();
  await assert.rejects(authenticate({ ...body, ...change }, origin, store, () => now), code(expected));
});
test('signature for another origin is denied', async () => {
  const { store, body } = await fixture();
  await assert.rejects(authenticate(body, 'https://attacker.example', store, () => now), code('audience_mismatch'));
});
test('malformed and legacy timestamp-only requests fail validation', async () => {
  const { store, body } = await fixture();
  for (const input of [null, [], 42, {}, { ...body, subject: '0x123' }, { ...body, signature: '0x1' }, { ...body, nonce: undefined, timestamp: now }, { ...body, resource: 'private-admin' }]) {
    await assert.rejects(authenticate(input, origin, store, () => now), code('bad_request'));
  }
});
test('signature cannot be altered by changing signed fields in storage', async () => {
  const { store, c, body } = await fixture();
  store.records.set(c.nonce, { ...c, resource: 'analytics-demo' });
  await assert.rejects(authenticate({ ...body, resource: 'analytics-demo' }, origin, store, () => now), code('invalid_signature'));
});
test('expiry during verification is denied before consuming', async () => {
  const { store, body } = await fixture();
  let calls = 0;
  await assert.rejects(authenticate(body, origin, store, () => ++calls >= 3 ? now + CHALLENGE_LIFETIME_MS : now), code('challenge_expired'));
});
test('shared-store failure fails closed and produces a safe error', async () => {
  const { store, body } = await fixture();
  store.consume = async () => { throw new GatewayError('auth_unavailable'); };
  await assert.rejects(authenticate(body, origin, store, () => now), code('auth_unavailable'));
  const response = authFailure(new Error('secret internal credentials'));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret'));
});
test('origin validation uses configured audience rather than host or forwarded headers', () => {
  const request = new Request('https://internal.example/api/challenge', { headers: { origin, 'x-forwarded-host': 'attacker.example' } });
  assert.equal(requestOrigin(request, origin), origin);
  assert.throws(() => requestOrigin(new Request(origin, { headers: { origin: 'https://attacker.example' } }), origin), code('audience_mismatch'));
  assert.throws(() => requestOrigin(new Request(origin), origin), code('audience_mismatch'));
  for (const invalid of ['https://accesslease.example/path', 'http://accesslease.example', 'https://user:password@accesslease.example']) {
    assert.throws(() => requestOrigin(request, invalid), code('auth_unavailable'));
  }
});
test('body validation rejects null, malformed JSON, oversized payloads and wrong content types', async () => {
  for (const body of ['{', 'a'.repeat(4097)]) {
    await assert.rejects(readAuthBody(new Request(origin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })), code('bad_request'));
  }
  await assert.rejects(readAuthBody(new Request(origin, { method: 'POST', body: '{}' })), code('bad_request'));
  assert.deepEqual(await readAuthBody(new Request(origin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })), {});
});

test('a public request cannot infer its own production audience from an untrusted host', () => {
  assert.throws(() => requestOrigin(new Request('https://attacker.example/api/challenge', { headers: { origin: 'https://attacker.example' } }), ''), code('auth_unavailable'));
});
