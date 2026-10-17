import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    chain: 'Tiramisu', chainId: 7738577,
    trustedIssuer: process.env.ARKIV_ISSUER_ADDRESS || null,
    validKey: process.env.SAMPLE_VALID_LEASE_KEY || null,
    forgedKey: process.env.SAMPLE_FORGED_LEASE_KEY || null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
