import { issueChallenge } from '@/lib/auth';
import { getChallengeStore } from '@/lib/challenge-store';
import { authFailure, NO_STORE, readAuthBody, requestOrigin } from '@/lib/auth-http';
import { accessMessage } from '@/lib/messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const origin = requestOrigin(request);
    const body = await readAuthBody(request);
    const challenge = await issueChallenge(body, origin, getChallengeStore());
    return Response.json({ challenge, message: accessMessage(challenge) }, { headers: NO_STORE });
  } catch (error) { return authFailure(error); }
}
