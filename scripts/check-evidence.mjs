// Validate captured observations without mocking policy, changing clocks or making requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = 'arkiv/evidence/2026-10-18';
const baseline = JSON.parse(fs.readFileSync(`${dir}/baseline.json`, 'utf8'));
const lifecycle = JSON.parse(fs.readFileSync(`${dir}/lifecycle.json`, 'utf8'));
const check = name => { const entry = lifecycle.checks.find(e => e.label === name); assert.ok(entry, name); return entry.value; };
const observed = [];
function response(name, status, reason) {
  const value = check(name);
  assert.equal(value.status, status, name);
  assert.equal(value.body.reason || value.body.decision?.reason, reason, name);
  if (reason !== 'allowed') assert.ok(!('data' in value.body), name + ' leaked data');
  observed.push({ name, status, reason, startedAt: value.startedAt });
}
assert.equal(baseline.chainId, 7738577);
assert.ok(lifecycle.completedAt && !lifecycle.error);
for (const e of baseline.entities) {
  const creation = e.events.find(v => v.eventName === 'EntityCreated');
  assert.ok(creation && creation.receiptStatus === 'success', e.label);
  assert.equal(creation.args.entityKey.toLowerCase(), e.key.toLowerCase());
  assert.notEqual(creation.transactionHash, e.key);
  assert.equal(creation.transactionSender.toLowerCase(), creation.args.owner.toLowerCase());
  if (e.status === 'present') {
    assert.equal(e.creator.toLowerCase(), creation.transactionSender.toLowerCase());
    assert.equal(e.creationBlock, creation.blockNumber);
  }
}
response('authenticated-allow', 200, 'allowed');
assert.match(check('authenticated-allow').body.data, /^SYNTHETIC:/);
response('authenticated-allow:replay', 403, 'challenge_used');
response('wrong-scope-public', 200, 'resource_mismatch');
response('wrong-scope-authenticated', 403, 'resource_mismatch');
response('wrong-recipient-authenticated', 403, 'subject_mismatch');
response('forged-public', 200, 'issuer_mismatch');
response('forged-authenticated', 403, 'issuer_mismatch');
response('wrong-origin', 403, 'audience_mismatch');
response('revoked-public', 200, 'not_found');
response('revoked-authenticated', 403, 'not_found');
response('before-deadline-authenticated', 200, 'allowed');
response('before-retention-expiry-authenticated', 200, 'allowed');
response('expired-deadline-public', 200, 'deadline_passed');
response('expired-deadline-authenticated', 403, 'deadline_passed');
response('expired-retention-public', 200, 'not_found');
response('expired-retention-authenticated', 403, 'not_found');
const before = check('deadline-fixture:on-chain-before');
const extended = check('deadline-after-storage-extension');
const expired = check('expired-deadline-on-chain');
assert.deepEqual(before.payload, extended.payload);
assert.deepEqual(before.payload, expired.payload);
assert.ok(BigInt(extended.expiresAtBlock) > BigInt(before.expiresAtBlock));
assert.ok(BigInt(expired.headBlock) < BigInt(expired.expiresAtBlock));
assert.ok(Date.parse(expired.checkedAt) > expired.payload.deadlineMs);
assert.equal(expired.status, 'present');
assert.equal(check('expired-retention-on-chain').status, 'absent');
const revocationEvents = check('revocation-events');
assert.ok(revocationEvents.some(e => e.eventName === 'EntityDeleted'));
for (const tx of lifecycle.transactions) assert.equal(tx.receipt.status, 'success');
const summary = { checkedAt: new Date().toISOString(), observationsChecked: observed.length, chainId: baseline.chainId, creationTransactionsVerified: baseline.entities.length, lifecycleTransactionsVerified: lifecycle.transactions.length, immutableDeadlineSurvivedStorageExtension: true, responses: observed, result: 'pass' };
// Preserve the submitted snapshot during routine validation.
if (process.argv.includes('--write-summary')) fs.writeFileSync(`${dir}/validation.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(`PASS: ${observed.length} production responses, ${baseline.entities.length} existing creation receipts, ${lifecycle.transactions.length} lifecycle receipts, unchanged deadline after storage extension.`);
