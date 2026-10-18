// Explicitly authorized, disposable Tiramisu fixtures only. No production configuration changes.
import { createWalletClient, ExpirationTime, jsonToPayload } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { client, directory, history, inspect, json, request, safeError, save } from './collect-evidence';
import { existsSync, readFileSync } from 'node:fs';

if (!process.argv.includes('--transact')) throw new Error('Pass --transact to authorize creating, extending and deleting disposable testnet fixtures.');
const resumeExpiration = process.argv.includes('--resume-expiration');
if (existsSync(`${directory}/lifecycle.json`) && !resumeExpiration) throw new Error('Existing lifecycle evidence found. Preserve it; do not repeat transactions accidentally.');
const issuer = privateKeyToAccount(process.env.ARKIV_ISSUER_PRIVATE_KEY as Hex);
if (issuer.address.toLowerCase() !== process.env.ARKIV_ISSUER_ADDRESS?.toLowerCase()) throw new Error('Issuer mismatch');
const signer = privateKeyToAccount(generatePrivateKey()); // discarded at exit, never persisted
const otherSigner = privateKeyToAccount(generatePrivateKey());
const wallet = createWalletClient({ chain: tiramisu, transport: http(process.env.ARKIV_RPC_URL || undefined, { timeout: 15_000, retryCount: 0 }), account: issuer });
const report: { startedAt: string; completedAt?: string; issuer: string; recipient: string; otherRecipient: string; expirationRecipient?: string; resumedAt?: string; previousAttemptError?: unknown; chainId?: number; transactions: unknown[]; checks: unknown[]; fixtures: Record<string, Awaited<ReturnType<typeof wallet.createEntity>>>; error?: unknown } = resumeExpiration ? JSON.parse(readFileSync(`${directory}/lifecycle.json`, 'utf8')) : { startedAt: new Date().toISOString(), issuer: issuer.address, recipient: signer.address, otherRecipient: otherSigner.address, transactions: [], checks: [], fixtures: {} };
if (resumeExpiration) {
  if (report.fixtures['deadline-fixture'] || !report.checks.some(c => (c as { label: string }).label === 'revoked-authenticated')) throw new Error('Resume is only valid after completed revocation checks and before expiration fixtures.');
  report.expirationRecipient = signer.address;
  report.resumedAt = new Date().toISOString();
  report.previousAttemptError = report.error;
  delete report.error;
}
const persist = () => save('lifecycle', report);
function record(label: string, value: unknown) { report.checks.push({ label, recordedAt: new Date().toISOString(), value }); persist(); console.log('saved', label); }
async function transaction(label: string, action: () => Promise<{ txHash: Hex }>) {
  const startedAt = new Date().toISOString();
  const result = await action();
  report.transactions.push({ label, startedAt, completedAt: new Date().toISOString(), ...result }); persist();
  const receipt = await client.getTransactionReceipt({ hash: result.txHash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  report.transactions[report.transactions.length - 1] = { label, startedAt, ...result, receipt, blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(), explorerTransactionUrl: `https://tiramisu.explorer.arkiv.network/tx/${result.txHash}` }; persist();
  console.log('confirmed', label, result.txHash);
  if (receipt.status !== 'success') throw new Error('Transaction reverted: ' + label);
  return result;
}
async function create(label: string, seconds: number) {
  const now = Date.now();
  const payload = { schema: 'accesslease/v1', subject: signer.address, resource: 'vault-demo', issuedAtMs: now, notBeforeMs: now, deadlineMs: now + seconds * 1000 };
  let result!: Awaited<ReturnType<typeof wallet.createEntity>>;
  await transaction(label, async () => result = await wallet.createEntity({ payload: jsonToPayload(payload), contentType: 'application/json', attributes: { project: 'accesslease-2026-v1', kind: 'lease', subject: signer.address, resource: 'vault-demo' }, expires: ExpirationTime.fromSeconds(seconds), flags: { readonly: true, permissionlessExtension: false } }));
  report.fixtures[label] = result; persist();
  record(label + ':on-chain-before', await inspect(result.entityKey));
  return { ...result, payload };
}
async function signedAccess(label: string, key: Hex, resource = 'vault-demo', account = signer, replay = false) {
  const response = await request('/api/challenge', { key, resource, subject: account.address });
  const body = response.body as { challenge?: { nonce: string; issuedAtMs: number; expiresAtMs: number; origin: string }; message?: string };
  // Never persist usable signatures, nonces, messages, private keys or raw auth requests.
  const challenge = body.challenge;
  record(label + ':challenge', { status: response.status, startedAt: response.startedAt, serverDate: response.serverDate, binding: { key, resource, subject: account.address }, challenge: challenge && { origin: challenge.origin, issuedAtMs: challenge.issuedAtMs, expiresAtMs: challenge.expiresAtMs } });
  if (!challenge || !body.message) throw new Error('Production challenge unavailable');
  const signature = await account.signMessage({ message: body.message });
  const requestBody = { key, resource, subject: account.address, nonce: challenge.nonce, signature };
  const access = await request('/api/access', requestBody);
  record(label, access);
  if (replay) record(label + ':replay', await request('/api/access', requestBody));
  return access;
}
async function main() {
  report.chainId = await client.getChainId();
  if (report.chainId !== 7738577) throw new Error('Wrong network');
  const config = await request('/api/config');
  if ((config.body as { trustedIssuer: string }).trustedIssuer.toLowerCase() !== issuer.address.toLowerCase()) throw new Error('Production trusts a different issuer');
  persist();
  if (!resumeExpiration) {
  record('issuer-testnet-balance', { wei: (await client.getBalance({ address: issuer.address })).toString() });
  const revocation = await create('revocation-fixture', 1200);
  const key = revocation.entityKey;
  record('trusted-public', await request(`/api/verify?key=${key}&resource=vault-demo`));
  await signedAccess('authenticated-allow', key, 'vault-demo', signer, true);
  record('wrong-scope-public', await request(`/api/verify?key=${key}&resource=analytics-demo`));
  await signedAccess('wrong-scope-authenticated', key, 'analytics-demo');
  await signedAccess('wrong-recipient-authenticated', key, 'vault-demo', otherSigner);
  const forgedKey = (config.body as { forgedKey: Hex }).forgedKey;
  record('forged-public', await request(`/api/verify?key=${forgedKey}&resource=vault-demo`));
  await signedAccess('forged-authenticated', forgedKey);
  record('wrong-origin', await request('/api/challenge', { key, resource: 'vault-demo', subject: signer.address }, 'https://example.invalid'));
  // Delete only the disposable entity created above; never the deployed showcase grant.
  await transaction('delete-revocation-fixture', () => wallet.deleteEntity({ entityKey: key }));
  record('revoked-on-chain', await inspect(key));
  record('revoked-public', await request(`/api/verify?key=${key}&resource=vault-demo`));
  await signedAccess('revoked-authenticated', key);
  record('revocation-events', await history(key));
  } else {
    record('revocation-events', await history(report.fixtures['revocation-fixture'].entityKey));
  }

  const deadline = await create('deadline-fixture', 60);
  await signedAccess('before-deadline-authenticated', deadline.entityKey);
  await transaction('extend-deadline-fixture-storage', () => wallet.extendEntity({ entityKey: deadline.entityKey, expires: ExpirationTime.fromSeconds(600) }));
  record('deadline-after-storage-extension', await inspect(deadline.entityKey));
  const retention = await create('retention-fixture', 60);
  await signedAccess('before-retention-expiry-authenticated', retention.entityKey);
  // Bounded real-time wait; no clock mocking and no application policy changes.
  for (let attempts = 0; attempts < 50; attempts++) {
    const head = await client.getBlockNumber({ cacheTime: 0 });
    if (Date.now() > Math.max(deadline.payload.deadlineMs, retention.payload.deadlineMs) + 1500 && head >= retention.expiresAt) break;
    if (attempts === 49) throw new Error('Timed out waiting for real expiration');
    if (attempts % 5 === 0) console.log('Waiting for real deadline and chain expiration; head', head.toString());
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  record('expired-deadline-on-chain', await inspect(deadline.entityKey));
  record('expired-deadline-public', await request(`/api/verify?key=${deadline.entityKey}&resource=vault-demo`));
  await signedAccess('expired-deadline-authenticated', deadline.entityKey);
  record('expired-retention-on-chain', await inspect(retention.entityKey));
  record('expired-retention-public', await request(`/api/verify?key=${retention.entityKey}&resource=vault-demo`));
  await signedAccess('expired-retention-authenticated', retention.entityKey);
  record('deadline-events', await history(deadline.entityKey));
  record('retention-events', await history(retention.entityKey));
  report.completedAt = new Date().toISOString(); persist();
}
main().catch(error => { report.error = safeError(error); persist(); console.error(json(report.error)); process.exitCode = 1; });
