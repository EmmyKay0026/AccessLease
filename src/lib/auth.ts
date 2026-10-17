import { randomBytes } from 'node:crypto';
import { isAddress, verifyMessage } from 'viem';
import { accessMessage, CHALLENGE_LIFETIME_MS, type Challenge } from './messages.ts';
import type { ChallengeStore } from './challenge-store.ts';
import { GatewayError } from './feedback.ts';
import { ENTITY_KEY, validResource, type Resource } from './policy.ts';

const NONCE = /^[a-f0-9]{64}$/;
const SIGNATURE = /^0x(?:[a-f0-9]{128}|[a-f0-9]{130})$/i;
export const validAddress = (value: unknown): value is `0x${string}` =>
  typeof value === 'string' && isAddress(value, { strict: false }) && !/^0x0{40}$/i.test(value);
export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GatewayError('bad_request');
  return value as Record<string, unknown>;
}
export type Binding = { key: string; resource: Resource; subject: string };
export function parseBinding(value: unknown): Binding {
  const { key, resource, subject } = objectBody(value);
  if (typeof key !== 'string' || !ENTITY_KEY.test(key) || typeof resource !== 'string' || !validResource(resource) || !validAddress(subject)) throw new GatewayError('bad_request');
  return { key: key.toLowerCase(), resource, subject: subject.toLowerCase() };
}
export function parseChallenge(value: unknown): Challenge {
  const c = objectBody(value);
  const binding = parseBinding(c);
  if (c.version !== 1 || typeof c.nonce !== 'string' || !NONCE.test(c.nonce) || typeof c.origin !== 'string' ||
      !Number.isSafeInteger(c.issuedAtMs) || !Number.isSafeInteger(c.expiresAtMs) ||
      (c.expiresAtMs as number) - (c.issuedAtMs as number) !== CHALLENGE_LIFETIME_MS) throw new GatewayError('bad_request');
  return { version: 1, nonce: c.nonce, origin: c.origin, ...binding, issuedAtMs: c.issuedAtMs as number, expiresAtMs: c.expiresAtMs as number };
}
export async function issueChallenge(value: unknown, origin: string, store: ChallengeStore, now = Date.now()): Promise<Challenge> {
  const challenge: Challenge = { version: 1, nonce: randomBytes(32).toString('hex'), origin, ...parseBinding(value), issuedAtMs: now, expiresAtMs: now + CHALLENGE_LIFETIME_MS };
  await store.create(challenge);
  return challenge;
}
export async function authenticate(value: unknown, origin: string, store: ChallengeStore, now = () => Date.now()): Promise<Challenge> {
  const body = objectBody(value);
  const binding = parseBinding(body);
  if (typeof body.nonce !== 'string' || !NONCE.test(body.nonce) || typeof body.signature !== 'string' || !SIGNATURE.test(body.signature)) throw new GatewayError('bad_request');
  const stored = await store.get(body.nonce);
  if (!stored) throw new GatewayError('challenge_used');
  const c = parseChallenge(stored);
  if (c.nonce !== body.nonce) throw new GatewayError('auth_unavailable');
  if (c.origin !== origin) throw new GatewayError('audience_mismatch');
  if (now() < c.issuedAtMs || now() >= c.expiresAtMs) throw new GatewayError('challenge_expired');
  if (c.key !== binding.key) throw new GatewayError('lease_mismatch');
  if (c.resource !== binding.resource) throw new GatewayError('resource_mismatch');
  if (c.subject !== binding.subject) throw new GatewayError('subject_mismatch');
  let valid = false;
  try { valid = await verifyMessage({ address: c.subject as `0x${string}`, message: accessMessage(c), signature: body.signature as `0x${string}` }); }
  catch { /* Invalid signatures deny access. */ }
  if (!valid) throw new GatewayError('invalid_signature');
  if (now() >= c.expiresAtMs) throw new GatewayError('challenge_expired');
  if (!await store.consume(c)) throw new GatewayError('challenge_used');
  return c;
}
