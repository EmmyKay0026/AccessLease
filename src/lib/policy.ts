// Pure, dependency-free security policy. Tested with Node's built-in test runner.
// Arkiv's live read supplies authoritative creator, owner, flags, and block height.
export const RESOURCES = ['vault-demo', 'analytics-demo'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Denial =
  | 'unconfigured' | 'not_found' | 'issuer_mismatch' | 'owner_mismatch'
  | 'mutable_lease' | 'permissionless_extension' | 'invalid_payload'
  | 'subject_mismatch' | 'resource_mismatch' | 'not_yet_valid'
  | 'deadline_passed' | 'chain_expired' | 'invalid_duration';
export type Decision = { allowed: boolean; reason: 'allowed' | Denial };
export type LeasePayload = {
  schema: 'accesslease/v1';
  subject: string;
  resource: Resource;
  issuedAtMs: number;
  notBeforeMs: number;
  deadlineMs: number;
};
export type LeaseRecord = {
  creator: string;
  owner: string;
  expiresAt: bigint;
  readonly: boolean;
  permissionlessExtension: boolean;
  payload: unknown;
};
const ADDRESS = /^0x[\da-f]{40}$/i;
export const ENTITY_KEY = /^0x[\da-f]{64}$/i;
const deny = (reason: Denial): Decision => ({ allowed: false, reason });
export const validResource = (value: string): value is Resource =>
  (RESOURCES as readonly string[]).includes(value);
export function evaluateLease(
  record: LeaseRecord,
  request: { issuer: string; resource: Resource; subject?: string; headBlock: bigint; nowMs: number }
): Decision {
  if (!ADDRESS.test(request.issuer)) return deny('unconfigured');
  if (record.creator.toLowerCase() !== request.issuer.toLowerCase()) return deny('issuer_mismatch');
  if (record.owner.toLowerCase() !== request.issuer.toLowerCase()) return deny('owner_mismatch');
  if (!record.readonly) return deny('mutable_lease');
  if (record.permissionlessExtension) return deny('permissionless_extension');
  if (record.expiresAt <= request.headBlock) return deny('chain_expired');
  const p = record.payload as Partial<LeasePayload> | null;
  if (!p || typeof p !== 'object' || p.schema !== 'accesslease/v1' ||
      typeof p.subject !== 'string' || !ADDRESS.test(p.subject) ||
      typeof p.resource !== 'string' || !validResource(p.resource) ||
      !Number.isSafeInteger(p.issuedAtMs) || !Number.isSafeInteger(p.notBeforeMs) ||
      !Number.isSafeInteger(p.deadlineMs)) return deny('invalid_payload');
  if (p.notBeforeMs! < p.issuedAtMs! - 60_000 || p.deadlineMs! <= p.notBeforeMs! ||
      p.deadlineMs! - p.issuedAtMs! > 120 * 60_000) return deny('invalid_duration');
  if (p.resource !== request.resource) return deny('resource_mismatch');
  if (request.subject && p.subject.toLowerCase() !== request.subject.toLowerCase()) return deny('subject_mismatch');
  if (request.nowMs < p.issuedAtMs! || request.nowMs < p.notBeforeMs!) return deny('not_yet_valid');
  if (request.nowMs >= p.deadlineMs!) return deny('deadline_passed');
  return { allowed: true, reason: 'allowed' };
}
