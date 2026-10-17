import type { Challenge } from './messages.ts';
import { GatewayError } from './feedback.ts';

export interface ChallengeStore {
  create(challenge: Challenge): Promise<void>;
  get(nonce: string): Promise<unknown>;
  consume(challenge: Challenge): Promise<boolean>;
}
// Compare and delete are atomic across function instances. Redis TIME enforces expiry
// at consumption, even if signature recovery is slow. Never retry ambiguous consumes.
export const CONSUME_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value or value ~= ARGV[1] then return 0 end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if now >= tonumber(ARGV[2]) then return -1 end
redis.call('DEL', KEYS[1])
return 1`;

export class RedisChallengeStore implements ChallengeStore {
  private url: string;
  private token: string;
  private fetcher: typeof fetch;
  constructor(url: string, token: string, fetcher: typeof fetch = fetch) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
      this.url = parsed.toString();
    } catch { throw new GatewayError('auth_unavailable'); }
    if (!token) throw new GatewayError('auth_unavailable');
    this.token = token;
    this.fetcher = fetcher;
  }
  private key(nonce: string) { return `accesslease:challenge:v1:${nonce}`; }
  private async command(args: (string | number)[]): Promise<unknown> {
    try {
      const response = await this.fetcher(this.url, {
        method: 'POST', cache: 'no-store', redirect: 'error',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error();
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || 'error' in body || !('result' in body)) throw new Error();
      return body.result;
    } catch { throw new GatewayError('auth_unavailable'); }
  }
  async create(challenge: Challenge) {
    // Retain expired records briefly to return a useful expiry error.
    const result = await this.command(['SET', this.key(challenge.nonce), JSON.stringify(challenge), 'NX', 'PX', 180_000]);
    if (result !== 'OK') throw new GatewayError('auth_unavailable');
  }
  async get(nonce: string): Promise<unknown> {
    const result = await this.command(['GET', this.key(nonce)]);
    if (result === null) return null;
    if (typeof result !== 'string') throw new GatewayError('auth_unavailable');
    try { return JSON.parse(result); } catch { throw new GatewayError('auth_unavailable'); }
  }
  async consume(challenge: Challenge): Promise<boolean> {
    const result = await this.command(['EVAL', CONSUME_SCRIPT, 1, this.key(challenge.nonce), JSON.stringify(challenge), challenge.expiresAtMs]);
    if (result === -1) throw new GatewayError('challenge_expired');
    if (result !== 0 && result !== 1) throw new GatewayError('auth_unavailable');
    return result === 1;
  }
}
// No process-local or permissive fallback, including during local development.
export function getChallengeStore(): ChallengeStore {
  return new RedisChallengeStore(process.env.UPSTASH_REDIS_REST_URL || '', process.env.UPSTASH_REDIS_REST_TOKEN || '');
}
