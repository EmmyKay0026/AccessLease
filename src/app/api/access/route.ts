import { verifyLiveLease } from '@/lib/arkiv';
import { authenticate } from '@/lib/auth';
import { getChallengeStore } from '@/lib/challenge-store';
import { authFailure, NO_STORE, readAuthBody, requestOrigin } from '@/lib/auth-http';
import { protectedResource } from '@/lib/protected-resource';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const origin = requestOrigin(request);
    const body = await readAuthBody(request);
    const challenge = await authenticate(body, origin, getChallengeStore());
    if (!request.headers.get('accept')?.includes('application/x-ndjson')) {
      const result = await protectedResource(challenge, verifyLiveLease);
      return Response.json(result.body, { status: result.status, headers: NO_STORE });
    }
    // Send the actual transition from authentication to the live permission check.
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ stage: 'checking_permission' }) + '\n'));
        const result = await protectedResource(challenge, verifyLiveLease);
        if (!cancelled) {
          controller.enqueue(encoder.encode(JSON.stringify({ result: result.body }) + '\n'));
          controller.close();
        }
      },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { headers: { ...NO_STORE, 'Content-Type': 'application/x-ndjson', 'X-Accel-Buffering': 'no' } });
  } catch (error) { return authFailure(error); }
}
