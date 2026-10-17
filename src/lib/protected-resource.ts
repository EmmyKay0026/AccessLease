import type { Challenge } from './messages.ts';
import type { Decision, Resource } from './policy.ts';

export async function protectedResource(challenge: Challenge, verify: (key: string, resource: Resource, subject: string) => Promise<{ decision: Decision }>) {
  try {
    const { decision } = await verify(challenge.key, challenge.resource, challenge.subject);
    if (!decision.allowed) return { status: 403, body: decision };
    return { status: 200, body: { allowed: true, reason: 'allowed', resource: challenge.resource,
      data: challenge.resource === 'vault-demo'
        ? 'SYNTHETIC: Incident vault report #AL-104 · No real confidential information.'
        : 'SYNTHETIC: Analytics dashboard: 83 successful security checks today.' } };
  } catch { return { status: 503, body: { allowed: false, reason: 'arkiv_unavailable' } }; }
}
