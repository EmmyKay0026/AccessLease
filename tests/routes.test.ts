import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { RedisChallengeStore, CONSUME_SCRIPT } from '../src/lib/challenge-store.ts';
import { GatewayError } from '../src/lib/feedback.ts';
import type { Challenge } from '../src/lib/messages.ts';

const account = privateKeyToAccount(generatePrivateKey());
const attacker = privateKeyToAccount(generatePrivateKey());
const issuer = '0x1111111111111111111111111111111111111111';
const key = '0x' + 'ab'.repeat(32);
const origin = 'https://accesslease.example';
const redisUrl = 'https://redis.unit-test.example';
const binding = { key, resource: 'vault-demo', subject: account.address.toLowerCase() };

test('API authentication and the installed Arkiv SDK enforce the complete access flow (mocked transports)', async t => {
  const previous = { ACCESSLEASE_ORIGIN: process.env.ACCESSLEASE_ORIGIN, ARKIV_ISSUER_ADDRESS: process.env.ARKIV_ISSUER_ADDRESS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN };
  Object.assign(process.env, { ACCESSLEASE_ORIGIN: origin, ARKIV_ISSUER_ADDRESS: issuer,
    UPSTASH_REDIS_REST_URL: redisUrl, UPSTASH_REDIS_REST_TOKEN: 'unit-test-only' });
  t.after(() => { for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  const records = new Map<string, string>();
  let mode = 'valid';
  let chainCalls = 0;
  let consumed = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = await request.json();
    if (request.url.startsWith(redisUrl)) {
      if (mode === 'redis-failure') return Response.json({ error: 'internal secrets' }, { status: 503 });
      const [command, ...args] = body as (string | number)[];
      if (command === 'SET') {
        const [name, value, nx, px, ttl] = args;
        assert.equal(nx, 'NX'); assert.equal(px, 'PX'); assert.equal(ttl, 180_000);
        if (records.has(String(name))) return Response.json({ result: null });
        records.set(String(name), String(value)); return Response.json({ result: 'OK' });
      }
      if (command === 'GET') return Response.json({ result: records.get(String(args[0])) ?? null });
      if (command === 'EVAL') {
        const [script, count, name, value, expires] = args;
        assert.equal(script, CONSUME_SCRIPT); assert.equal(count, 1);
        if (records.get(String(name)) !== value) return Response.json({ result: 0 });
        if (Date.now() >= Number(expires)) return Response.json({ result: -1 });
        records.delete(String(name)); consumed++; return Response.json({ result: 1 });
      }
      throw Error('Unexpected Redis command');
    }
    chainCalls++;
    if (mode === 'network-failure') throw Error('Internal RPC credential must not escape');
    assert.ok(consumed > 0, 'no Arkiv query before atomic nonce consumption');
    const rpc = body as { id: number; method: string; params: unknown[] };
    if (rpc.method === 'eth_blockNumber') return Response.json({ jsonrpc: '2.0', id: rpc.id, result: '0x1f4' });
    assert.equal(rpc.method, 'arkiv_query');
    assert.ok(String(rpc.params[0]).includes('$key'));
    const time = Date.now();
    const payload = { schema: 'accesslease/v1', subject: mode === 'wrong-recipient' ? attacker.address : account.address,
      resource: mode === 'wrong-resource' ? 'analytics-demo' : 'vault-demo',
      issuedAtMs: mode === 'future' ? time + 30_000 : time - 60_000,
      notBeforeMs: mode === 'future' ? time + 30_000 : time - 60_000,
      deadlineMs: mode === 'expired' ? time - 1 : time + 60_000,
      issuer }; // This payload claim must never override the authoritative creator.
    const entity = { key, creator: mode === 'forged' ? attacker.address : issuer,
      owner: mode === 'transferred' ? attacker.address : issuer,
      expiresAt: mode === 'chain-expired' ? '0x1f4' : '0x3e8',
      creationFlags: mode === 'mutable' ? 0 : mode === 'unsafe-extension' ? 3 : 1,
      payload: toHex(JSON.stringify(payload)), contentType: 'application/json' };
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { data: mode === 'revoked' ? [] : [entity], blockNumber: '0x1f4' } });
  });
  const { POST: challengePost } = await import('../src/app/api/challenge/route.ts');
  const { POST: accessPost } = await import('../src/app/api/access/route.ts');
  const request = (path: string, body: unknown, extra: Record<string, string> = {}) => new Request(origin + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify(body),
  });
  async function signed() {
    const response = await challengePost(request('/api/challenge', binding));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const { challenge, message } = await response.json();
    assert.equal(challenge.subject, binding.subject);
    const signature = await account.signMessage({ message });
    return { ...binding, nonce: challenge.nonce, signature };
  }
  await t.test('authorized recipient receives the protected synthetic resource', async () => {
    mode = 'valid'; const response = await accessPost(request('/api/access', await signed()));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json(); assert.equal(body.allowed, true); assert.match(body.data, /^SYNTHETIC:/);
  });
  await t.test('replay is rejected before another Arkiv query', async () => {
    mode = 'valid'; const body = await signed();
    await accessPost(request('/api/access', body)); const before = chainCalls;
    const response = await accessPost(request('/api/access', body));
    assert.equal(response.status, 403); assert.equal((await response.json()).reason, 'challenge_used'); assert.equal(chainCalls, before);
  });
  await t.test('concurrent API submissions permit only one chain check and result', async () => {
    mode = 'valid'; const body = await signed();
    const responses = await Promise.all([accessPost(request('/api/access', body)), accessPost(request('/api/access', body))]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 403]);
  });
  for (const [scenario, expected] of [
    ['forged', 'issuer_mismatch'], ['expired', 'deadline_passed'], ['revoked', 'not_found'],
    ['wrong-recipient', 'subject_mismatch'], ['wrong-resource', 'resource_mismatch'], ['future', 'not_yet_valid'],
    ['transferred', 'owner_mismatch'], ['mutable', 'mutable_lease'], ['unsafe-extension', 'permissionless_extension'],
    ['chain-expired', 'chain_expired'],
  ]) await t.test(scenario + ' permission is denied after live SDK decoding', async () => {
    mode = scenario; const response = await accessPost(request('/api/access', await signed()));
    assert.equal(response.status, 403);
    const body = await response.json(); assert.equal(body.reason, expected); assert.equal(body.allowed, false); assert.equal(body.data, undefined);
  });
  await t.test('Arkiv failure returns 503, leaks no details and still consumes the nonce', async () => {
    mode = 'network-failure'; const body = await signed();
    const response = await accessPost(request('/api/access', body));
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { allowed: false, reason: 'arkiv_unavailable' });
    mode = 'valid'; const retry = await accessPost(request('/api/access', body));
    assert.equal((await retry.json()).reason, 'challenge_used');
  });
  await t.test('streaming response reports Arkiv stage before a final grant', async () => {
    mode = 'valid'; const response = await accessPost(request('/api/access', await signed(), { Accept: 'application/x-ndjson' }));
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(events[0].stage, 'checking_permission'); assert.equal(events[1].result.allowed, true);
  });
  await t.test('streamed Arkiv failure reports a final denial without protected data', async () => {
    mode = 'network-failure'; const response = await accessPost(request('/api/access', await signed(), { Accept: 'application/x-ndjson' }));
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(events[1].result, { allowed: false, reason: 'arkiv_unavailable' });
  });
  await t.test('Redis outage fails closed, returns safe feedback, and never reaches Arkiv', async () => {
    mode = 'valid'; const body = await signed(); mode = 'redis-failure'; const before = chainCalls;
    const response = await accessPost(request('/api/access', body));
    assert.equal(response.status, 503); assert.equal((await response.json()).reason, 'auth_unavailable'); assert.equal(chainCalls, before);
    const challenge = await challengePost(request('/api/challenge', binding)); assert.equal(challenge.status, 503);
  });
  await t.test('cross-origin and malformed requests never reach storage or Arkiv', async () => {
    mode = 'valid'; const response = await challengePost(request('/api/challenge', binding, { Origin: 'https://attacker.example' }));
    assert.equal(response.status, 403); assert.equal((await response.json()).reason, 'audience_mismatch');
    for (const body of [null, [], {}, { ...binding, key: 'bad' }]) {
      const result = await challengePost(request('/api/challenge', body)); assert.equal(result.status, 400);
    }
  });
  await t.test('unconfigured production storage cannot fall back to local memory', async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const response = await challengePost(request('/api/challenge', binding));
    assert.equal(response.status, 503); assert.equal((await response.json()).reason, 'auth_unavailable');
    process.env.UPSTASH_REDIS_REST_TOKEN = 'unit-test-only';
  });
});
test('Redis adapter validates atomic consumption outcomes and never retries ambiguity', async () => {
  const c: Challenge = { version: 1, nonce: 'ef'.repeat(32), origin, key, resource: 'vault-demo', subject: account.address.toLowerCase(), issuedAtMs: 1, expiresAtMs: 120_001 };
  for (const result of [1, 0, -1, 'unexpected']) {
    let calls = 0;
    const store = new RedisChallengeStore(redisUrl, 'unit-test-only', async () => { calls++; return Response.json({ result }); });
    if (result === 1 || result === 0) assert.equal(await store.consume(c), result === 1);
    else await assert.rejects(store.consume(c), (e: unknown) => e instanceof GatewayError && e.code === (result === -1 ? 'challenge_expired' : 'auth_unavailable'));
    assert.equal(calls, 1);
  }
  let calls = 0;
  const store = new RedisChallengeStore(redisUrl, 'unit-test-only', async () => { calls++; throw Error('lost response'); });
  await assert.rejects(store.consume(c), GatewayError); assert.equal(calls, 1);
});
