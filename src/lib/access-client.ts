import { toHex } from 'viem';
import { accessMessage, type Challenge } from './messages.ts';
import { GatewayError, safeError } from './feedback.ts';
import { requestData } from './client-http.ts';
import { recipient, walletRequest, watchWallet, type Wallet } from './wallet.ts';
import type { Resource } from './policy.ts';

export type AccessStage = 'idle' | 'connecting' | 'awaiting_signature' | 'verifying_signature' | 'checking_permission' | 'granted' | 'denied';
export const stageLabels: Record<AccessStage, string> = {
  idle: '', connecting: 'Connecting wallet', awaiting_signature: 'Awaiting signature',
  verifying_signature: 'Verifying signature', checking_permission: 'Checking Arkiv permission',
  granted: 'Access granted', denied: 'Access denied',
};
export type AccessResult = { allowed: boolean; reason?: string; resource?: string; data?: string };
type AccessUI = {
  busy(value: boolean): void; stage(value: AccessStage): void;
  result(value: AccessResult | null): void; error(value: string): void; account(value: string): void;
};
async function readAccess(response: Response, stage: AccessUI['stage']): Promise<AccessResult> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const data = await response.json();
    if (!response.ok) throw new GatewayError(typeof data?.reason === 'string' ? data.reason : 'service_error');
    if (typeof data?.allowed !== 'boolean') throw new GatewayError('service_error');
    return data;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new GatewayError('service_error');
  const decoder = new TextDecoder();
  let pending = '';
  let result: AccessResult | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 16_384) throw new GatewayError('service_error');
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const event = JSON.parse(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (event.stage === 'checking_permission') stage('checking_permission');
        if (event.result && typeof event.result.allowed === 'boolean') result = event.result;
      }
    }
  } finally { reader.releaseLock(); }
  if (!result || pending.trim()) throw new GatewayError('service_error');
  return result;
}

// The page uses this action directly; all wallet/network failures share the same finally.
export async function runAccessAction(input: {
  wallet?: Wallet; key: string; resource: Resource; origin: string; controller: AbortController;
  walletTimeoutMs?: number; signatureTimeoutMs?: number; httpTimeoutMs?: number;
}, ui: AccessUI): Promise<void> {
  const { controller } = input;
  const signal = controller.signal;
  let unwatch = () => {};
  let subject = '';
  ui.busy(true); ui.result(null); ui.error(''); ui.stage('connecting');
  const activeStage = (stage: AccessStage) => { if (!signal.aborted) ui.stage(stage); };
  try {
    if (!input.wallet?.supported) throw new GatewayError('wallet_unavailable');
    const provider = input.wallet.provider;
    unwatch = watchWallet(provider, accounts => {
      if (!subject) return;
      let next = '';
      try { next = recipient(accounts); } catch { /* Locked/disconnected accounts invalidate the flow. */ }
      if (next !== subject) controller.abort(new GatewayError('account_changed'));
    }, () => controller.abort(new GatewayError('wallet_disconnected')));
    subject = recipient(await walletRequest(provider, 'eth_requestAccounts', undefined, signal, input.walletTimeoutMs ?? 30_000));
    ui.account(subject);
    const binding = { key: input.key.toLowerCase(), resource: input.resource, subject };
    const challengeResponse = await requestData<{ challenge?: Challenge; message?: string; reason?: string }>(
      '/api/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(binding) }, signal,
      async response => {
        const data = await response.json();
        if (!response.ok) throw new GatewayError(typeof data?.reason === 'string' ? data.reason : 'service_error');
        return data;
      }, input.httpTimeoutMs,
    );
    const c = challengeResponse.challenge;
    if (!c || c.version !== 1 || c.key !== binding.key || c.resource !== binding.resource || c.subject !== subject ||
      c.origin !== input.origin || !/^[a-f0-9]{64}$/.test(c.nonce) || !Number.isSafeInteger(c.issuedAtMs) ||
      !Number.isSafeInteger(c.expiresAtMs) || c.expiresAtMs - c.issuedAtMs !== 120_000 || challengeResponse.message !== accessMessage(c)) throw new GatewayError('service_error');
    // Do not use the browser clock for challenge validity. The server owns both times.
    activeStage('awaiting_signature');
    const signature = await walletRequest(provider, 'personal_sign', [toHex(challengeResponse.message), subject], signal, input.signatureTimeoutMs ?? 120_000);
    if (typeof signature !== 'string') throw new GatewayError('invalid_signature');
    const current = recipient(await walletRequest(provider, 'eth_accounts', undefined, signal, input.walletTimeoutMs ?? 30_000));
    if (current !== subject) throw new GatewayError('account_changed');
    activeStage('verifying_signature');
    const result = await requestData<AccessResult>('/api/access', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ ...binding, nonce: c.nonce, signature }),
    }, signal, response => readAccess(response, activeStage), input.httpTimeoutMs);
    if (signal.aborted) throw signal.reason;
    ui.result(result); ui.stage(result.allowed ? 'granted' : 'denied');
  } catch (error) { ui.error(safeError(error)); ui.stage('denied'); }
  finally { unwatch(); ui.busy(false); }
}
