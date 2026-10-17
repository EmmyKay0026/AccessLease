import { GatewayError } from './feedback.ts';

// Wallet requests cannot be cancelled by EIP-1193. Racing bounds the UI wait and
// ignores late resolutions; the original promise still has rejection handlers.
export function bounded<T>(operation: () => Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal?.reason instanceof GatewayError ? signal.reason : new GatewayError('request_cancelled'));
    const timer = setTimeout(() => { cleanup(); reject(new GatewayError('request_timeout')); }, ms);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    const onAbort = () => { cleanup(); abort(); };
    if (signal?.aborted) { cleanup(); abort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(() => {
      if (signal?.aborted) throw signal.reason;
      return operation();
    }).then(v => { cleanup(); resolve(v); }, e => { cleanup(); reject(e); });
  });
}
export async function requestData<T>(url: string, init: RequestInit = {}, signal?: AbortSignal, parse?: (response: Response) => Promise<T>, ms = 25_000): Promise<T> {
  const controller = new AbortController();
  const propagate = () => controller.abort(signal?.reason);
  if (signal?.aborted) propagate();
  else signal?.addEventListener('abort', propagate, { once: true });
  try {
    return await bounded(async () => {
      const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
      return parse ? await parse(response) : await response.json() as T;
    }, ms, signal);
  } finally {
    controller.abort();
    signal?.removeEventListener('abort', propagate);
  }
}
