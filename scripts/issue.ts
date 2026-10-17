import { createWalletClient, ExpirationTime, jsonToPayload } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { validResource } from '../src/lib/policy';

// Run with --forge to simulate an attacker copying a valid lease's public metadata.
const forge = process.argv.includes('--forge');
function arg(name: string): string | undefined {
  return process.argv.find(v => v.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}
const subject = arg('subject');
const resource = arg('resource') || 'vault-demo';
const minutes = Number(arg('minutes') ?? '20');
const key = forge ? process.env.ARKIV_ATTACKER_PRIVATE_KEY : process.env.ARKIV_ISSUER_PRIVATE_KEY;
if (!key || !/^0x[\da-f]{64}$/i.test(key)) throw new Error(forge ? 'Set ARKIV_ATTACKER_PRIVATE_KEY' : 'Set ARKIV_ISSUER_PRIVATE_KEY');
if (!subject || !/^0x[\da-f]{40}$/i.test(subject) || !validResource(resource)) throw new Error('Usage: npm run lease:issue -- --subject=0x... --resource=vault-demo --minutes=20');
if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 120) throw new Error('Minutes must be 1–120');
const account = privateKeyToAccount(key as `0x${string}`);
const trusted = process.env.ARKIV_ISSUER_ADDRESS;
if (!forge && (!trusted || account.address.toLowerCase() !== trusted.toLowerCase())) {
  throw new Error('ARKIV_ISSUER_ADDRESS must match your CLI issuer private key');
}
if (forge && trusted && account.address.toLowerCase() === trusted.toLowerCase()) {
  throw new Error('Attacker wallet must differ from the trusted issuer');
}
const client = createWalletClient({
  chain: tiramisu, transport: http(process.env.ARKIV_RPC_URL || undefined), account,
});
const issuedAtMs = Date.now();
const payload = { schema: 'accesslease/v1', subject, resource, issuedAtMs,
  notBeforeMs: issuedAtMs, deadlineMs: issuedAtMs + minutes * 60_000 };
const result = await client.createEntity({
  contentType: 'application/json',
  payload: jsonToPayload(payload),
  attributes: {
    project: 'accesslease-2026-v1', kind: 'lease', resource, subject,
  },
  expires: ExpirationTime.fromSeconds(minutes * 60),
  flags: { readonly: true, permissionlessExtension: false },
});
console.log(JSON.stringify({
  label: forge ? 'FORGED ENTITY (must be denied by verifier)' : 'TRUSTED LEASE',
  wallet: account.address, entityKey: result.entityKey, txHash: result.txHash,
  chainExpiresAtBlock: result.expiresAt?.toString(),
  deadline: new Date(payload.deadlineMs).toISOString(),
}, null, 2));
