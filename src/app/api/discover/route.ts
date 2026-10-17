import { NextResponse } from 'next/server';
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { str } from '@arkiv-network/sdk/attr';
import { http } from 'viem';
export const dynamic = 'force-dynamic';
export async function GET() {
  const issuer = process.env.ARKIV_ISSUER_ADDRESS || '';
  if (!/^0x[\da-f]{40}$/i.test(issuer) || /^0x0{40}$/i.test(issuer)) {
    return NextResponse.json({ error: 'Trusted issuer not configured', leases: [] }, { status: 503 });
  }
  try {
    const client = createPublicClient({ chain: tiramisu, transport: http(process.env.ARKIV_RPC_URL || undefined, { timeout: 8_000, retryCount: 0 }) });
    const page = await client
      .select({key: true, creator: true, payload: true})
      .where(eq('project', str('accesslease-2026-v1')), eq('kind', str('lease')))
      .createdBy(issuer as `0x${string}`)
      .limit(30).fetch();
    const leases = page.entities.flatMap(e => {
      try {
        const p = e.toJson();
        if (p.schema !== 'accesslease/v1' || typeof p.deadlineMs !== 'number') return [];
        return [{key:e.key,resource:p.resource,deadlineMs:p.deadlineMs,creator:e.creator}];
      } catch { return []; }
    });
    return NextResponse.json({ leases, blockNumber: page.blockNumber.toString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({error:'Live discovery unavailable',leases:[]}, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
