// Read-only capture. Never writes transactions or serializes environment configuration.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createPublicClient, ENTITY_EVENTS_ABI } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { createPublicClient as createViemClient, decodeEventLog, http, toHex } from 'viem';
import { evaluateLease, type Resource } from '../src/lib/policy';

const origin = 'https://accesslease-three.vercel.app';
export const directory = 'arkiv/evidence/2026-10-18';
mkdirSync(directory, { recursive: true });
export const client = createPublicClient({ chain: tiramisu, transport: http(process.env.ARKIV_RPC_URL || undefined, { timeout: 15_000, retryCount: 0 }) });
const rpc = createViemClient({ chain: tiramisu, transport: http(process.env.ARKIV_RPC_URL || undefined, { timeout: 15_000, retryCount: 0 }) });
export const json = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
export const save = (name: string, value: unknown) => writeFileSync(`${directory}/${name}.json`, json(value) + '\n');
export const safeError = (error: unknown) => ({ name: (error as Error).name, message: (error as { shortMessage?: string }).shortMessage || 'Operation failed; raw transport details omitted.' });
export async function request(path: string, body?: unknown, requestOrigin = origin) {
  const startedAt = new Date().toISOString();
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: body === undefined ? {} : { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data: unknown;
  try { data = JSON.parse(raw); } catch { data = { title: raw.match(/<title>(.*?)<\/title>/)?.[1], bytes: raw.length, lucideMarkup: raw.includes('lucide'), documentationSections: [...raw.matchAll(/id="(introduction|workflow|architecture|security|demo|developer|faq)"/g)].map(m => m[1]) }; }
  return { startedAt, completedAt: new Date().toISOString(), path, status: response.status, serverDate: response.headers.get('date'), cacheControl: response.headers.get('cache-control'), body: data };
}
export async function inspect(key: `0x${string}`, resource: Resource = 'vault-demo') {
  const checkedAt = new Date().toISOString();
  try {
    const e = await client.getEntity(key);
    const head = await client.getBlockNumber({ cacheTime: 0 });
    const payload = e.toJson();
    return { checkedAt, key, status: 'present', creator: e.creator, owner: e.owner, creationBlock: e.createdAt, expiresAtBlock: e.expiresAt, headBlock: head, creationFlags: e.creationFlags, attributes: e.attributes, payload, localPolicy: evaluateLease({ creator: e.creator, owner: e.owner, expiresAt: e.expiresAt, readonly: e.creationFlags.readonly, permissionlessExtension: e.creationFlags.permissionlessExtension, payload }, { issuer: process.env.ARKIV_ISSUER_ADDRESS || '', resource, headBlock: head, nowMs: Date.now() }) };
  } catch (error) { return { checkedAt, key, status: (error as Error).name === 'NoEntityFoundError' ? 'absent' : 'unavailable', error: safeError(error) }; }
}
export async function history(key: `0x${string}`) {
  // EntityCreated's indexed key links an entity to a transaction; they are distinct IDs.
  const logs = [];
  let end = await client.getBlockNumber({ cacheTime: 0 });
  // The public node rejects an unbounded genesis-to-head range. Filter by key and
  // walk bounded ranges backwards until the immutable creation event is found.
  for (;;) {
    const start = end > 99_999n ? end - 99_999n : 0n;
    const page = await rpc.request({ method: 'eth_getLogs', params: [{ address: '0x4400000000000000000000000000000000000044', topics: [null, key], fromBlock: toHex(start), toBlock: toHex(end) }] });
    logs.unshift(...page);
    if (page.some(log => decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: log.topics, data: log.data }).eventName === 'EntityCreated') || start === 0n) break;
    end = start - 1n;
  }
  const events = [];
  for (const log of logs) {
    if (!log.transactionHash || !log.blockNumber) continue;
    const decoded = decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: log.topics, data: log.data });
    const [receipt, tx, block] = await Promise.all([client.getTransactionReceipt({ hash: log.transactionHash }), client.getTransaction({ hash: log.transactionHash }), client.getBlock({ blockNumber: BigInt(log.blockNumber) })]);
    events.push({ eventName: decoded.eventName, args: decoded.args, blockNumber: BigInt(log.blockNumber), blockHash: log.blockHash, logIndex: log.logIndex, transactionHash: log.transactionHash, transactionSender: tx.from, transactionTo: tx.to, receiptStatus: receipt.status, blockTimestampSeconds: block.timestamp, blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(), explorerTransactionUrl: `https://tiramisu.explorer.arkiv.network/tx/${log.transactionHash}`, rawLog: log, transactionInput: tx.input, receipt });
  }
  return events;
}

async function main() {
  const configResponse = await request('/api/config');
  const config = configResponse.body as { validKey: `0x${string}`; forgedKey: `0x${string}` };
  const result: Record<string, unknown> = { startedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, sdk: JSON.parse(readFileSync('node_modules/@arkiv-network/sdk/package.json', 'utf8')).version, viem: JSON.parse(readFileSync('node_modules/viem/package.json', 'utf8')).version, configResponse, chainId: await client.getChainId(), headBlock: await client.getBlockNumber({ cacheTime: 0 }), pages: [], entities: [] };
  save('baseline', result);
  for (const path of ['/', '/docs', '/api/discover']) (result.pages as unknown[]).push(await request(path));
  const keys = [ ['local-trusted', process.env.SAMPLE_VALID_LEASE_KEY], ['local-forged', process.env.SAMPLE_FORGED_LEASE_KEY], ['production-trusted', config.validKey], ['production-forged', config.forgedKey] ];
  for (const [label, value] of keys) {
    if (!value || !/^0x[\da-f]{64}$/i.test(value)) continue;
    const key = value as `0x${string}`;
    const item: Record<string, unknown> = { label, ...await inspect(key), publicVerification: await request(`/api/verify?key=${key}&resource=vault-demo`) };
    try { item.events = await history(key); } catch (error) { item.historyError = safeError(error); }
    (result.entities as unknown[]).push(item);
    save('baseline', result);
    console.log(label, item.status, 'saved with', Array.isArray(item.events) ? item.events.length : 0, 'events');
  }
  result.completedAt = new Date().toISOString();
  save('baseline', result);
  console.log('Saved public baseline to ' + directory + '/baseline.json');
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/collect-evidence.ts')) main().catch(error => { console.error(json(safeError(error))); process.exitCode = 1; });
