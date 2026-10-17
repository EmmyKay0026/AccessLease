import { GatewayError } from './feedback.ts';

export const NO_STORE = { 'Cache-Control': 'no-store' };
export function requestOrigin(request: Request, configured = process.env.ACCESSLEASE_ORIGIN): string {
  let expected: URL;
  try {
    // Production uses a fixed audience, never forwarded host headers.
    const url = new URL(request.url);
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!configured && !local) throw new Error();
    expected = new URL(configured || url.origin);
    if (!['https:', 'http:'].includes(expected.protocol) || expected.pathname !== '/' || expected.search || expected.hash || expected.username || expected.password ||
      (expected.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(expected.hostname))) throw new Error();
  } catch { throw new GatewayError('auth_unavailable'); }
  if (request.headers.get('origin') !== expected.origin) throw new GatewayError('audience_mismatch');
  return expected.origin;
}
export async function readAuthBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new GatewayError('bad_request');
  const reader = request.body?.getReader();
  if (!reader) throw new GatewayError('bad_request');
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new GatewayError('bad_request'); }
  finally { reader.releaseLock(); }
}
export function authFailure(error: unknown): Response {
  const safe = error instanceof GatewayError ? error : new GatewayError('auth_unavailable');
  const status = safe.code === 'bad_request' ? 400 : safe.code === 'auth_unavailable' ? 503 : safe.code === 'challenge_expired' ? 410 : 403;
  return Response.json({ allowed: false, reason: safe.code, error: safe.message }, { status, headers: NO_STORE });
}
