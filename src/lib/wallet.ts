import { isAddress } from 'viem';
import { GatewayError } from './feedback.ts';
import { bounded } from './client-http.ts';

export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isPhantom?: boolean;
};
export type Wallet = { id: string; name: string; rdns: string; provider: WalletProvider; supported: boolean };
export function discoverWallets(target: EventTarget, update: (wallets: Wallet[]) => void) {
  const wallets = new Map<string, Wallet>();
  const announce = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || typeof detail !== 'object') return;
    const { info, provider } = detail;
    if (!info || typeof info.uuid !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(info.uuid) ||
      typeof info.name !== 'string' || info.name.length > 100 || typeof info.rdns !== 'string' || !provider || typeof provider.request !== 'function') return;
    if (wallets.has(info.uuid) || [...wallets.values()].some(w => w.provider === provider)) return;
    const supported = info.rdns === 'io.metamask' && provider.isPhantom !== true;
    wallets.set(info.uuid, { id: info.uuid, name: info.name, rdns: info.rdns, provider, supported });
    update([...wallets.values()]);
  };
  target.addEventListener('eip6963:announceProvider', announce);
  target.dispatchEvent(new Event('eip6963:requestProvider'));
  return () => target.removeEventListener('eip6963:announceProvider', announce);
}
export function recipient(accounts: unknown): string {
  const value = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof value !== 'string' || !isAddress(value, { strict: false }) || /^0x0{40}$/i.test(value)) throw new GatewayError('invalid_account');
  return value.toLowerCase();
}
export function watchWallet(provider: WalletProvider, changed: (accounts: unknown) => void, disconnected: () => void) {
  const onChange = (...args: unknown[]) => changed(args[0]);
  const onDisconnect = () => disconnected();
  provider.on?.('accountsChanged', onChange);
  provider.on?.('disconnect', onDisconnect);
  return () => {
    provider.removeListener?.('accountsChanged', onChange);
    provider.removeListener?.('disconnect', onDisconnect);
  };
}
export async function walletRequest(provider: WalletProvider, method: string, params: unknown[] | undefined, signal: AbortSignal, timeoutMs: number) {
  try { return await bounded(() => provider.request({ method, params }), timeoutMs, signal); }
  catch (error) {
    if (error instanceof GatewayError) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 4001) throw new GatewayError(method === 'eth_requestAccounts' ? 'connection_rejected' : 'signature_rejected');
    if (code === -32002) throw new GatewayError('wallet_pending');
    throw new GatewayError('wallet_error');
  }
}
