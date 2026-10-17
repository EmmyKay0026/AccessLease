import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLease, type LeaseRecord, type Resource } from '../src/lib/policy.ts';
const issuer = '0x1111111111111111111111111111111111111111';
const subject = '0x2222222222222222222222222222222222222222';
const adversary = '0x3333333333333333333333333333333333333333';
const now = 1_797_000_000_000;
const record = (): LeaseRecord => ({
  creator: issuer, owner: issuer, expiresAt: 1000n,
  readonly: true, permissionlessExtension: false,
  payload: {schema:'accesslease/v1',subject,resource:'vault-demo',
    issuedAtMs: now - 2*60_000,notBeforeMs:now - 2*60_000,deadlineMs:now + 18*60_000},
});
const request = {issuer, resource: 'vault-demo' as Resource, subject, headBlock: 500n, nowMs: now};
function check(update: Partial<LeaseRecord>, req: Partial<typeof request> = {}) {
  return evaluateLease({...record(),...update},{...request,...req}).reason;
}
test('trusted read-only lease grants correct scope and subject',()=>assert.equal(check({}),'allowed'));
test('forged creator always denied',()=>assert.equal(check({creator:adversary}),'issuer_mismatch'));
test('ownership transfer is denied',()=>assert.equal(check({owner:adversary}),'owner_mismatch'));
test('mutable permissions are denied',()=>assert.equal(check({readonly:false}),'mutable_lease'));
test('permissionless extension is denied',()=>assert.equal(check({permissionlessExtension:true}),'permissionless_extension'));
test('Arkiv entity expired at current head',()=>assert.equal(check({expiresAt:500n}),'chain_expired'));
test('wrong scope denied',()=>assert.equal(check({}, {resource:'analytics-demo'}),'resource_mismatch'));
test('wrong wallet denied',()=>assert.equal(check({}, {subject:adversary}),'subject_mismatch'));
test('fixed deadline wins even after storage extension',()=>assert.equal(check({expiresAt:99999999n}, {nowMs:now+20*60_000}),'deadline_passed'));
test('future lease denied',()=>assert.equal(check({}, {nowMs:now-3*60_000}),'not_yet_valid'));
test('lease longer than two hours denied',()=>assert.equal(check({payload:{...record().payload as object, deadlineMs:now+3*60*60_000}}),'invalid_duration'));
test('corrupted payload denied',()=>assert.equal(check({payload:{schema:'unknown'}}),'invalid_payload'));

test('future issuance is denied even when notBefore is backdated', () => assert.equal(check({payload:{...record().payload as object, issuedAtMs: now + 30_000, notBeforeMs: now}}), 'not_yet_valid'));
