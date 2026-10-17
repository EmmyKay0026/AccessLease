import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import type { LeaseRecord, Resource, Decision } from './policy';
import { evaluateLease, ENTITY_KEY } from './policy';

const RPC = process.env.ARKIV_RPC_URL || undefined;
const client = createPublicClient({ chain: tiramisu, transport: http(RPC, { timeout: 8_000, retryCount: 0 }) });
export const trustedIssuer = () => process.env.ARKIV_ISSUER_ADDRESS || '';
export type Verification = { decision: Decision; creator?: string; owner?: string; expiresAtBlock?: string; subject?: string; resource?: string; deadlineMs?: number };

export async function verifyLiveLease(key: string, resource: Resource, subject?: string): Promise<Verification> {
  if (!ENTITY_KEY.test(key)) return { decision: { allowed: false, reason: 'not_found' } };
  const issuer = trustedIssuer();
  if (!/^0x[\da-f]{40}$/i.test(issuer) || /^0x0{40}$/i.test(issuer)) {
    return { decision: { allowed: false, reason: 'unconfigured' } };
  }
  let entity;
  try {
    entity = await client.getEntity(key as `0x${string}`);
  } catch (error) {
    // Only a documented not-found outcome is a denial. RPC failures propagate (fail closed).
    const e = error as { name?: string; message?: string };
    if (e.name === 'NoEntityFoundError' || /NoEntityFound|entity not found/i.test(e.message ?? '')) {
      return { decision: { allowed: false, reason: 'not_found' } };
    }
    throw error;
  }
  const headBlock = await client.getBlockNumber({ cacheTime: 0 });
  let payload: unknown;
  try { payload = entity.toJson(); } catch { payload = null; }
  const record: LeaseRecord = {
    creator: entity.creator ?? '', owner: entity.owner ?? '',
    expiresAt: entity.expiresAt ?? 0n,
    readonly: entity.creationFlags?.readonly === true,
    permissionlessExtension: entity.creationFlags?.permissionlessExtension === true,
    payload,
  };
  const decision = evaluateLease(record, { issuer, resource, subject, headBlock, nowMs: Date.now() });
  const p = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    decision, creator: record.creator, owner: record.owner,
    expiresAtBlock: record.expiresAt.toString(),
    subject: typeof p.subject === 'string' ? p.subject : undefined,
    resource: typeof p.resource === 'string' ? p.resource : undefined,
    deadlineMs: typeof p.deadlineMs === 'number' ? p.deadlineMs : undefined,
  };
}
