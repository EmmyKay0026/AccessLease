import type { Resource } from './policy.ts';

export const CHALLENGE_LIFETIME_MS = 120_000;
export type Challenge = {
  version: 1; nonce: string; origin: string; subject: string; key: string;
  resource: Resource; issuedAtMs: number; expiresAtMs: number;
};

// The exact UTF-8 text is stored by the server and signed with EIP-191 personal_sign.
export function accessMessage(c: Challenge): string {
  return [
    'AccessLease synthetic-resource access (v1)',
    `Origin: ${c.origin}`,
    `Wallet: ${c.subject}`,
    `Lease: ${c.key}`,
    `Resource: ${c.resource}`,
    `Nonce: ${c.nonce}`,
    `Issued at: ${new Date(c.issuedAtMs).toISOString()}`,
    `Expires at: ${new Date(c.expiresAtMs).toISOString()}`,
    'Sign only to request this synthetic resource. This does not send a transaction.',
  ].join('\n');
}
