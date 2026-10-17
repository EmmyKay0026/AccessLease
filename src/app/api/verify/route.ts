import { NextRequest, NextResponse } from 'next/server';
import { verifyLiveLease } from '@/lib/arkiv';
import { validResource } from '@/lib/policy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = params.get('key') || '';
  const resource = params.get('resource') || '';
  if (!validResource(resource)) return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  try {
    return NextResponse.json(await verifyLiveLease(key, resource), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ decision: { allowed: false, reason: 'arkiv_unavailable' }, error: 'Arkiv verification unavailable — deny by default' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
