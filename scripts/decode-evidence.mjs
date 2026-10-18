// Offline decoding of public creation calldata already captured by collect-evidence.ts.
import fs from 'node:fs';
import { decodeFunctionData, parseAbi, decodeAbiParameters, parseAbiParameters, hexToString } from 'viem';
const dir = 'arkiv/evidence/2026-10-18';
const baseline = JSON.parse(fs.readFileSync(`${dir}/baseline.json`, 'utf8'));
const creations = baseline.entities.map(entity => {
  const event = entity.events.find(e => e.eventName === 'EntityCreated');
  const call = decodeFunctionData({ abi: parseAbi(['function execute((uint8 operation, bytes operationData)[] ops) external returns (bytes32[] keys)']), data: event.transactionInput });
  const operation = call.args[0].find(o => o.operation === 1);
  const [create] = decodeAbiParameters(parseAbiParameters('(uint128 salt,uint64 expiresAt,uint64 minLifetime,uint8 creationFlags,(bytes32 name,uint8 typeId,bytes value)[] attributes)'), operation.operationData);
  const attributes = create.attributes.map(a => ({ name: hexToString(a.name).replace(/\0/g, ''), typeId: a.typeId, value: hexToString(a.value) }));
  return { label: entity.label, entityKey: entity.key, transactionHash: event.transactionHash, creationBlock: event.blockNumber, blockTimestamp: event.blockTimestamp, transactionSender: event.transactionSender, initialOwner: event.args.owner, initialExpiresAtBlock: event.args.expiresAt, creationFlags: event.args.creationFlags, attributes, payload: JSON.parse(attributes.find(a => a.name === '$payload').value) };
});
fs.writeFileSync(`${dir}/decoded-creations.json`, JSON.stringify(creations, null, 2) + '\n');
console.log(`Decoded ${creations.length} verified creation transactions offline.`);
