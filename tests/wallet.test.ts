import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToString, type Hex } from 'viem';
import { discoverWallets, recipient, type Wallet, type WalletProvider } from '../src/lib/wallet.ts';
import { runAccessAction, type AccessResult, type AccessStage } from '../src/lib/access-client.ts';
import { accessMessage, type Challenge } from '../src/lib/messages.ts';
import { requestData } from '../src/lib/client-http.ts';
import { GatewayError, labels } from '../src/lib/feedback.ts';

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const key = '0x' + 'ab'.repeat(32);
const origin = 'https://accesslease.example';
class Provider extends EventEmitter implements WalletProvider {
  calls: string[] = [];
  mode = '';
  async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
    this.calls.push(method);
    if (this.mode === 'reject-connection' && method === 'eth_requestAccounts') throw { code: 4001, message: 'extension stack must not leak' };
    if (this.mode === 'pending') throw { code: -32002 };
    if (this.mode === 'hang-connection' && method === 'eth_requestAccounts') return new Promise(() => {});
    if (method === 'eth_requestAccounts') return [account.address];
    if (method === 'eth_accounts') return [this.mode === 'silent-switch' ? other.address : account.address];
    if (method === 'personal_sign') {
      if (this.mode === 'reject-signature') throw { code: 4001 };
      if (this.mode === 'hang-signature') return new Promise(() => {});
      if (this.mode === 'switch') { this.emit('accountsChanged', [other.address]); return 'ignored late response'; }
      if (this.mode === 'disconnect') { this.emit('disconnect'); return 'ignored late response'; }
      assert.equal(params?.[1], account.address.toLowerCase());
      assert.match(String(params?.[0]), /^0x[0-9a-f]+$/);
      return account.signMessage({ message: hexToString(params?.[0] as Hex) });
    }
    throw Error('unexpected wallet method');
  }
}
function wallet(provider: Provider): Wallet {
  return { id: '350670db-19fa-4704-a166-e52e178b59d2', name: 'MetaMask', rdns: 'io.metamask', provider, supported: true };
}
function ui() {
  const state = { busy: false, stages: [] as AccessStage[], result: null as AccessResult | null, error: '', account: '' };
  return { state, actions: {
    busy: (v: boolean) => { state.busy = v; }, stage: (v: AccessStage) => { state.stages.push(v); },
    result: (v: AccessResult | null) => { state.result = v; }, error: (v: string) => { state.error = v; },
    account: (v: string) => { state.account = v; },
  } };
}
function mockApi(t: TestContext, mode = 'success') {
  const requests: string[] = [];
  let requestSignal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    requests.push(url); requestSignal = init.signal as AbortSignal;
    if (mode === 'hang') return new Promise<Response>(() => {});
    if (mode === 'network-error') throw Error('sensitive infrastructure details');
    if (url === '/api/challenge') {
      if (mode === 'malformed') return new Response('<html>bad upstream</html>');
      if (mode === 'expired') return Response.json({ reason: 'challenge_expired' }, { status: 410 });
      const binding = JSON.parse(init.body as string);
      const c: Challenge = { version: 1, nonce: 'ef'.repeat(32), origin, ...binding, issuedAtMs: Date.now(), expiresAtMs: Date.now() + 120_000 };
      c.expiresAtMs = c.issuedAtMs + 120_000;
      return Response.json({ challenge: c, message: accessMessage(c) });
    }
    if (mode === 'stream-hang') return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"stage":"checking_permission"}\n')); } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    const result = { allowed: mode !== 'denied', reason: mode === 'denied' ? 'subject_mismatch' : 'allowed', ...(mode === 'denied' ? {} : { data: 'SYNTHETIC: fixture' }) };
    const text = JSON.stringify({ stage: 'checking_permission' }) + '\n' + JSON.stringify({ result }) + '\n';
    // Chunk boundaries deliberately split JSON and newlines.
    const encoded = new TextEncoder().encode(text);
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoded.slice(0, 9)); controller.enqueue(encoded.slice(9, 35)); controller.enqueue(encoded.slice(35)); controller.close();
    } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  });
  return { requests, signal: () => requestSignal };
}
test('EIP-6963 discovers MetaMask alongside Phantom without requesting any accounts', () => {
  const target = new EventTarget();
  const metamask = new Provider();
  const phantom = new Provider();
  let found: Wallet[] = [];
  const stop = discoverWallets(target, value => { found = value; });
  function announce(id: string, rdns: string, provider: WalletProvider) {
    target.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: id, name: rdns, rdns }, provider } }));
  }
  announce('350670db-19fa-4704-a166-e52e178b59d2', 'app.phantom', phantom);
  announce('350670db-19fa-4704-a166-e52e178b59d3', 'io.metamask', metamask);
  announce('350670db-19fa-4704-a166-e52e178b59d3', 'io.metamask', metamask);
  assert.equal(found.length, 2);
  assert.equal(found.filter(w => w.supported).length, 1);
  assert.equal(found.find(w => w.supported)?.provider, metamask);
  assert.equal(phantom.calls.length + metamask.calls.length, 0);
  stop();
  announce('350670db-19fa-4704-a166-e52e178b59d4', 'io.metamask', new Provider());
  assert.equal(found.length, 2);
});
test('discovery registers listener before requesting providers and handles late announcements', () => {
  const target = new EventTarget();
  let found: Wallet[] = [];
  target.addEventListener('eip6963:requestProvider', () => target.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: { info: { uuid: '350670db-19fa-4704-a166-e52e178b59d2', name: 'MetaMask', rdns: 'io.metamask' }, provider: new Provider() },
  })));
  const stop = discoverWallets(target, v => { found = v; });
  assert.equal(found.length, 1); stop();
});
test('recipient validation rejects empty, malformed and zero addresses', () => {
  for (const accounts of [null, [], ['0x123'], ['0x' + '0'.repeat(40)]]) assert.throws(() => recipient(accounts), GatewayError);
  assert.equal(recipient([account.address]), account.address.toLowerCase());
});
test('selected MetaMask flow encodes UTF-8 as hex and reports every real stage', async t => {
  const api = mockApi(t); const provider = new Provider(); const view = ui();
  await runAccessAction({ wallet: wallet(provider), key, resource: 'vault-demo', origin, controller: new AbortController() }, view.actions);
  assert.deepEqual(view.state.stages, ['connecting', 'awaiting_signature', 'verifying_signature', 'checking_permission', 'granted']);
  assert.equal(view.state.result?.allowed, true); assert.equal(view.state.busy, false); assert.equal(view.state.error, '');
  assert.deepEqual(api.requests, ['/api/challenge', '/api/access']);
  assert.deepEqual(provider.calls, ['eth_requestAccounts', 'personal_sign', 'eth_accounts']);
  assert.equal(provider.listenerCount('accountsChanged'), 0);
});
for (const [mode, expected] of [
  ['reject-connection', 'connection_rejected'], ['reject-signature', 'signature_rejected'],
  ['switch', 'account_changed'], ['silent-switch', 'account_changed'], ['disconnect', 'wallet_disconnected'],
  ['pending', 'wallet_pending'], ['hang-connection', 'request_timeout'], ['hang-signature', 'request_timeout'],
] as const) test(mode + ' resets loading, denies access, and never sends a stale access request', async t => {
  const api = mockApi(t); const provider = new Provider(); provider.mode = mode; const view = ui();
  await runAccessAction({ wallet: wallet(provider), key, resource: 'vault-demo', origin, controller: new AbortController(), walletTimeoutMs: 15, signatureTimeoutMs: 15 }, view.actions);
  assert.equal(view.state.busy, false); assert.equal(view.state.stages.at(-1), 'denied');
  assert.equal(view.state.error, labels[expected]); assert.equal(view.state.result, null);
  assert.ok(!api.requests.includes('/api/access'));
  assert.equal(provider.listenerCount('disconnect'), 0);
});
for (const [mode, expected] of [
  ['hang', 'request_timeout'], ['stream-hang', 'request_timeout'], ['network-error', 'service_error'],
  ['malformed', 'service_error'], ['expired', 'challenge_expired'],
] as const) test(mode + ' HTTP failure resets loading and exposes only safe feedback', async t => {
  const api = mockApi(t, mode); const view = ui();
  await runAccessAction({ wallet: wallet(new Provider()), key, resource: 'vault-demo', origin, controller: new AbortController(), httpTimeoutMs: 20 }, view.actions);
  assert.equal(view.state.busy, false); assert.equal(view.state.stages.at(-1), 'denied');
  assert.equal(view.state.error, labels[expected]); assert.equal(view.state.result, null);
  assert.equal(api.signal()?.aborted, true);
});
test('permission denial terminates loading and does not display protected data', async t => {
  mockApi(t, 'denied'); const view = ui();
  await runAccessAction({ wallet: wallet(new Provider()), key, resource: 'vault-demo', origin, controller: new AbortController() }, view.actions);
  assert.equal(view.state.busy, false); assert.equal(view.state.stages.at(-1), 'denied');
  assert.equal(view.state.result?.reason, 'subject_mismatch'); assert.equal(view.state.result?.data, undefined);
});
test('missing selection cannot silently fall back to an injected wallet', async () => {
  const view = ui();
  await runAccessAction({ key, resource: 'vault-demo', origin, controller: new AbortController() }, view.actions);
  assert.equal(view.state.error, labels.wallet_unavailable); assert.equal(view.state.busy, false);
});
test('late wallet response after timeout cannot resume signing or grant access', async t => {
  const api = mockApi(t); const provider = new Provider(); const view = ui();
  let complete!: (value: unknown) => void;
  provider.request = () => new Promise(resolve => { complete = resolve; });
  await runAccessAction({ wallet: wallet(provider), key, resource: 'vault-demo', origin, controller: new AbortController(), walletTimeoutMs: 15 }, view.actions);
  complete([account.address]); await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(api.requests, []); assert.equal(view.state.result, null); assert.equal(view.state.busy, false);
});
test('HTTP timeout aborts the fetch request, including a stalled body', async t => {
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    signal = init.signal as AbortSignal;
    return new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } });
  });
  await assert.rejects(requestData('/api/config', {}, undefined, undefined, 15), (e: unknown) => e instanceof GatewayError && e.code === 'request_timeout');
  assert.equal(signal?.aborted, true);
});

test('account switching during the Arkiv stage prevents a late grant', async t => {
  mockApi(t); const provider = new Provider(); const view = ui();
  const actions = { ...view.actions, stage(value: AccessStage) {
    view.actions.stage(value);
    if (value === 'checking_permission') provider.emit('accountsChanged', [other.address]);
  } };
  await runAccessAction({ wallet: wallet(provider), key, resource: 'vault-demo', origin, controller: new AbortController() }, actions);
  assert.equal(view.state.busy, false); assert.equal(view.state.result, null);
  assert.equal(view.state.stages.at(-1), 'denied'); assert.equal(view.state.error, labels.account_changed);
});
test('an already-cancelled action cannot open a wallet prompt', async () => {
  const provider = new Provider(); const view = ui(); const controller = new AbortController();
  controller.abort(new GatewayError('request_cancelled'));
  await runAccessAction({ wallet: wallet(provider), key, resource: 'vault-demo', origin, controller }, view.actions);
  assert.deepEqual(provider.calls, []); assert.equal(view.state.busy, false); assert.equal(view.state.error, labels.request_cancelled);
});
