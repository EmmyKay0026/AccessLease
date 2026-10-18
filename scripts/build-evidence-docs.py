"""Generate readable, public reports from captured evidence. Standard library only."""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'arkiv/evidence/2026-10-18'
baseline = json.loads((DIR / 'baseline.json').read_text())
lifecycle = json.loads((DIR / 'lifecycle.json').read_text())
decoded = json.loads((DIR / 'decoded-creations.json').read_text())
validation = json.loads((DIR / 'validation.json').read_text())
checks = {entry['label']: entry['value'] for entry in lifecycle['checks']}
docs = ROOT / 'docs'
docs.mkdir(exist_ok=True)
repo = 'https://github.com/EmmyKay0026/AccessLease'
issuer = lifecycle['issuer']
attacker = next(e['creator'] for e in baseline['entities'] if e['label'] == 'production-forged')

def utc(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def wat(ms):
    return datetime.fromtimestamp(ms / 1000, timezone(timedelta(hours=1))).isoformat(timespec='milliseconds')

def txlink(hash):
    return f'[`{hash}`](https://tiramisu.explorer.arkiv.network/tx/{hash})'

lines = [
    '# AccessLease security evidence — 18 October 2026', '',
    f'Verified against the deployed application, https://accesslease-three.vercel.app, and the public Arkiv Tiramisu RPC (chain ID 7738577). Capture window: **{lifecycle["startedAt"]}–{lifecycle["completedAt"]}** (07:13–07:16 Nigerian time). The existing application was not redeployed or changed.', '',
    f'Application source baseline: `{baseline["sourceCommit"]}`. Runtime: Node {baseline["node"]}, Arkiv SDK {baseline["sdk"]}, viem {baseline["viem"]}. These are measured versions from this checkout.', '',
    '## Verified production behavior', '',
    'These are fresh HTTP observations, separate from the historical manual results reported by the owner. Automated signatures used disposable in-memory EVM accounts and the production challenge service. No nonce, signature, private key, Redis token or credential-bearing URL is retained.', '',
    '| Scenario | HTTP | Observed reason |', '| --- | --- | --- |',
]
for entry in validation['responses']:
    lines.append(f'| `{entry["name"]}` | {entry["status"]} | `{entry["reason"]}` |')
lines += [
    '', 'Public `/api/verify` returns HTTP 200 for a completed policy decision, including a denial; authenticated JSON `/api/access` returns HTTP 403 for denied access. Every captured denial lacked protected `data`. Successful requests returned the explicitly synthetic incident vault report. `Cache-Control: no-store` was captured on the verification and access responses.', '',
    'The replay response followed a successful request using the exact same in-memory signed body. It returned HTTP 403 and `challenge_used`. New challenges were obtained for subsequent permission tests.', '',
    '## Existing real Arkiv entities', '',
    f'Trusted issuer: `{issuer}`. Attacker: `{attacker}`. Shared showcase recipient: `{decoded[0]["payload"]["subject"]}`. The recipient is a public test address. Every grant below scopes access to `vault-demo`.', '',
    'Creation transactions were recovered using key-filtered `eth_getLogs` against the Arkiv system address `0x4400000000000000000000000000000000000044`, decoded with the installed SDK ABI, and cross-checked against transaction senders, successful receipts and block timestamps. An entity key is **not** its transaction hash.', '',
]
for entity, creation in zip(baseline['entities'], decoded):
    event = next(e for e in entity['events'] if e['eventName'] == 'EntityCreated')
    payload = creation['payload']
    lines += [
        f'### {entity["label"]}', '',
        f'- Entity key: `{entity["key"]}`.',
        f'- Creation transaction: {txlink(creation["transactionHash"])}.',
        f'- Creation block: **{creation["creationBlock"]}**; block timestamp: **{creation["blockTimestamp"]}**.',
        f'- Creation transaction sender: `{creation["transactionSender"]}`; initial owner from `EntityCreated`: `{creation["initialOwner"]}`.',
        f'- Live `$creator`: `{entity.get("creator", "unavailable: entity absent at verification")}`; live owner: `{entity.get("owner", "unavailable: entity absent at verification")}`.',
        f'- Subject: `{payload["subject"]}`; resource: `{payload["resource"]}`.',
        f'- Issuer-authored issuance time: `{utc(payload["issuedAtMs"])}`. This is payload metadata, not a consensus timestamp.',
        f'- Fixed authorization deadline: **{utc(payload["deadlineMs"])}** / **{wat(payload["deadlineMs"])} Nigerian time**.',
        f'- Original chain expiry: block **{creation["initialExpiresAtBlock"]}**. Creation flag byte **{creation["creationFlags"]}**: `readonly=true`, `permissionlessExtension=false`.',
        f'- Status at `{entity["checkedAt"]}`: **{entity["status"]}**; public result: `{entity["publicVerification"]["body"]["decision"]["reason"]}`.', '',
    ]
lines += [
    'For absent historical entities, the original publisher, payload and flags were recovered from confirmed creation events and calldata. A fresh `$creator`/owner lookup is unavailable after expiry; absence alone does not prove whether a record expired or was deleted. Their recorded chain expiry and elapsed deadline establish that their original authorization window ended. For the two present production entities, SDK `$creator` values independently matched their creation transaction senders.', '',
    'The forged entity copies the project, kind, subject and resource fields, but its actual creator is the attacker. The public and authenticated verifiers both returned `issuer_mismatch` while that entity was present.', '',
    '## Real revocation and expiration', '',
    'Exactly three new disposable entities were created by the trusted test issuer. One was deleted, and one had storage retention extended. The deployed showcase entities were not deleted or modified. Five new transactions were confirmed successfully.', '',
    '| Operation | Entity key | Transaction | Block | Block timestamp (UTC) |', '| --- | --- | --- | --- | --- |',
]
for tx in lifecycle['transactions']:
    key = tx.get('entityKey') or lifecycle['fixtures']['revocation-fixture']['entityKey']
    lines.append(f'| {tx["label"]} | `{key}` | {txlink(tx["txHash"])} | {tx["receipt"]["blockNumber"]} | {tx["blockTimestamp"]} |')
for label in ['revocation-fixture', 'deadline-fixture', 'retention-fixture']:
    entity = checks[label + ':on-chain-before']
    lines += [
        '', f'### {label}', '',
        f'Entity: `{entity["key"]}`. Live creator and owner: `{entity["creator"]}`. Subject: `{entity["payload"]["subject"]}`; scope: `vault-demo`. Flags: `readonly=true`, `permissionlessExtension=false`.', '',
        f'Fixed deadline: `{utc(entity["payload"]["deadlineMs"])}`. Initial chain expiry: `{entity["expiresAtBlock"]}`. It was present and locally allowed before its lifecycle check; authenticated access also succeeded before deletion/expiry.', '',
    ]
before = checks['deadline-fixture:on-chain-before']
extended = checks['deadline-after-storage-extension']
expired = checks['expired-deadline-on-chain']
lines += [
    '### What the lifecycle observations establish', '',
    f'1. **Revocation:** the revocation fixture granted signed access, then a confirmed `EntityDeleted` event was recorded. A new SDK lookup found no entity; a new public verification returned `not_found`; a newly signed authenticated request returned **403/not_found**. This is deletion evidence, not an inference from absence alone.',
    f'2. **Fixed deadline after storage extension:** the owner extended the read-only deadline fixture from expiry block **{before["expiresAtBlock"]}** to **{extended["expiresAtBlock"]}**. The complete parsed payload was identical before extension and after the deadline. At head **{expired["headBlock"]}**, the entity remained present and below its chain expiry, but public verification and authenticated access denied with `deadline_passed` (**403** on access).',
    '3. **Arkiv retention expiration:** a separate 60-second lease allowed authenticated access before expiration. After real time and the corresponding chain expiry, `getEntity` returned `NoEntityFoundError`; public verification denied and a newly signed request returned **403/not_found**. Its event history contains creation and no explicit deletion or extension. No expiry event was required for enforcement.', '',
    'The controller waited for real wall-clock time and live chain height. It did not mock time, alter gateway policy, change Redis configuration or redeploy production.', '',
    '## Evidence files and reproduction', '',
    '- [`baseline.json`](../arkiv/evidence/2026-10-18/baseline.json): public config, HTTP page/discovery checks, four SDK observations, creation logs, calldata and receipts.',
    '- [`decoded-creations.json`](../arkiv/evidence/2026-10-18/decoded-creations.json): decoded historical/public creation payloads, clearly separated from current live state.',
    '- [`lifecycle.json`](../arkiv/evidence/2026-10-18/lifecycle.json): transaction receipts, before/after on-chain snapshots and redacted production HTTP results.',
    '- [`validation.json`](../arkiv/evidence/2026-10-18/validation.json): offline assertions covering 16 production outcomes, four existing creation receipts, five new lifecycle receipts and fixed-deadline preservation.',
    '- [`rpc-and-explorer.json`](../arkiv/evidence/2026-10-18/rpc-and-explorer.json): exact `query exceeds max block range 100000` error and HTTP 200 checks for both production creation transaction explorer URLs.',
    '- [`QA_RESULTS.md`](QA_RESULTS.md): current automated suite/build/audit results and browser limitations.',
    '- [`DEMO.md`](DEMO.md): three-minute script, video description and recording handoff.', '',
    'Read-only collection (writes local evidence files, not on-chain state):', '',
    '```powershell', 'node --env-file=.env --import tsx scripts/collect-evidence.ts', 'node scripts/decode-evidence.mjs', 'node scripts/check-evidence.mjs', '```', '',
    'Archive an existing capture before intentionally collecting a different dated run. The scripts currently target the 18 October evidence directory; preserve this submitted snapshot. `check-evidence.mjs` makes no network requests.', '',
    'The lifecycle script submits transactions and is deliberately guarded against repeating an existing run. To reproduce with fresh dedicated wallets in a separate checkout/capture directory: configure issuer credentials locally, then run `node --env-file=.env --import tsx scripts/lifecycle-evidence.ts --transact`. It generates recipients only in memory, issues three fixtures, confirms deletion/extension, signs production challenges and waits for real expiry. It never prints private keys or persists signed request bodies. The documented `--resume-expiration` mode was used once after an evidence log query exceeded the RPC range limit; already completed issuance/deletion checks were preserved, and the second recipient is separately recorded.', '',
    '## Scope and remaining operator work', '',
    'Fresh production wallet authentication here used viem/EIP-191 signatures. **MetaMask extension UI was not reverified in this session.** The owner previously reported a successful MetaMask run; that remains a historical report. Browser helpers returned `FrameArrived timed out` and `get_window_state` timeout; no screenshot or wallet interaction is claimed.', '',
    'Production `/` and `/docs` returned HTTP 200, expected titles and Lucide markup. This verifies served HTML, not responsive rendering, hydration or wallet-provider selection. The latest source contains EIP-6963 selection, exact origin binding, random two-minute challenges and shared Redis atomic consumption, with 75 automated tests covering policy/authentication/wallet behavior.', '',
    'No on-chain read-only patch attack or forced production RPC/Redis outage was performed. Fail-closed outage behavior is covered locally; do not describe those cases as live production experiments. This is a synthetic MVP without production abuse controls or a perpetual authorization/audit service.', '',
    f'The captured production trusted sample authorization ends at **{wat(next(e["payload"]["deadlineMs"] for e in baseline["entities"] if e["label"] == "production-trusted"))} Nigerian time**. It will deny after that window. Refresh disposable examples near recording/judging using the existing CLI; extending storage cannot extend authorization. Do not promise permanent live access from a two-hour grant.', '',
    'The local MP4 is an evidence walkthrough of captured results, not a live browser/MetaMask screen recording. Upload a publicly accessible video and finish the Devfolio form separately. Owner-only team declarations and final submission status must be confirmed by the owner. Working submission cutoff: **18 October 2026, 23:59 Africa/Lagos (22:59 UTC)**.', '',
]
(docs / 'SECURITY_EVIDENCE.md').write_text('\n'.join(lines), encoding='utf-8')

friction = f'''# Arkiv implementation friction — verified 18 October 2026

Measured environment: Node {baseline['node']}, Arkiv SDK {baseline['sdk']}, viem {baseline['viem']}, Tiramisu chain ID 7738577. [Full evidence](../docs/SECURITY_EVIDENCE.md). These observations supersede the old pending network-experiment entries.

| Surface | Expected | Actual, with reproduction | Result |
| --- | --- | --- | --- |
| SDK create/getEntity | Immutable, scoped record with authoritative creator | Create a readonly lease with the existing CLI; getEntity exposes creator, owner, flags, createdAt and expiresAt. Four prior creation receipts recovered; three new grants confirmed. | Verified |
| Creator-filtered query | Only trusted issuer appears in discovery | GET /api/discover used `.createdBy(issuer)`; returned the trusted production grant and its block number. Copied project/subject/resource fields did not authenticate the attacker. | Verified |
| Authentic publisher | Forged metadata cannot impersonate issuer | The production forged grant's creator was `{attacker}`; public verification and signed access returned issuer_mismatch. | Verified |
| Readonly lifetime extension | Fixed access cutoff despite longer storage | Owner successfully extended a readonly entity's expiry from {before['expiresAtBlock']} to {extended['expiresAtBlock']}; immutable payload/deadline stayed unchanged. A later signed request denied deadline_passed while the entity remained live. | Verified |
| Expiration | Fresh reads stop returning expired entities | Create a 60-second lease, observe signed access, wait for wall clock and live chain height, then getEntity returns NoEntityFoundError and signed access returns 403/not_found. No expiry event is needed. | Verified |
| Deletion | Owner revocation denies immediately after inclusion/read | Delete only the new fixture. Successful receipt and EntityDeleted link the deletion to the same key; fresh signed request returns 403/not_found. | Verified |
| Direct JSON-RPC history | Recover creation transaction separately from entity key | An unbounded genesis-to-head eth_getLogs request returned InvalidParamsRpcError. Key-filtered backward windows of at most 100,000 blocks succeeded. `scripts/collect-evidence.ts` records raw logs, calldata, receipts and block timestamps. | Reproduced query limit |
| Entity history after expiry | Preserve enough evidence to audit issuance | Both old local sample keys were absent. Their creation logs, transaction senders and decoded payloads were recoverable from transaction history, but fresh system creator/owner reads were unavailable. | Verified limitation |

**Suggested improvement:** document that `readonly` freezes content, not the owner's ability to extend storage. Include an authorization example with an immutable application deadline and a fail-closed fresh lookup. Also document eth_getLogs range limits beside a small key-filtered history example, and clearly distinguish `createdAt` block height, consensus block timestamp and issuer-supplied payload time.

**Reproduce:** run the read-only collection and offline validation commands in [SECURITY_EVIDENCE.md](../docs/SECURITY_EVIDENCE.md). For new lifecycle experiments, use the guarded transaction script with dedicated testnet wallets. Commands, exact keys, hashes, versions and before/after values are in the evidence JSON.

**Not measured on-chain:** rejecting a patch to a readonly record. **Not induced in production:** RPC/Redis outage. Their source/unit coverage is not substituted for a live experiment. Browser/MetaMask capture was unavailable in this session. No SDK package installation failure is asserted as current behavior.
'''
(ROOT / 'arkiv/friction.md').write_text(friction, encoding='utf-8')

submission = f'''# AccessLease — submission preparation

**Track:** Security (Global). **Tagline:** Grant temporary access. Verify every permission. Trust no expired lease.

**Live application:** https://accesslease-three.vercel.app/
**Documentation:** https://accesslease-three.vercel.app/docs
**Repository:** {repo}
**Schema:** {repo}/blob/main/arkiv/schema.md
**Friction report:** {repo}/blob/main/arkiv/friction.md
**Security evidence:** {repo}/blob/main/docs/SECURITY_EVIDENCE.md

These GitHub evidence links become available after the evidence commit is pushed. A local MP4 is prepared at `artifacts/demo/accesslease-evidence-demo.mp4`; the public hosted video URL remains an owner action. Do not submit a local path as the video URL.

## The problem it solves

Contractors and incident responders need temporary access to one resource. A copied permission document should not impersonate the trusted issuer, authorize a different wallet, outlive its deadline or survive revocation. AccessLease makes the grant publicly inspectable on Arkiv and requires the recipient to sign a purpose-bound, single-use challenge before the gateway returns an explicitly synthetic incident vault. Every protected fetch rechecks live permission state.

## Why Arkiv?

Arkiv exposes the actual immutable creator, owner, creation flags and finite entity lifetime independently of AccessLease's API. Postgres or our own API alone would let the operator supply unverifiable authorship claims; IPFS content addressing does not itself establish the trusted Arkiv publisher or current revocation state. A subgraph could index another authorization contract, but that would require a different issuing/enforcement system. Here Arkiv directly supplies the queryable lease evidence. The off-chain gateway still controls delivery and must be trusted to enforce policy; public evidence does not force an arbitrary server to behave honestly.

## How we use Arkiv

- [Issue CLI]({repo}/blob/main/scripts/issue.ts): synthetic recipient/resource attributes and readonly JSON payload with a fixed authorization deadline.
- [Live verifier]({repo}/blob/main/src/lib/arkiv.ts): getEntity plus fresh block height, actual creator/owner/flags and expiry checks.
- [Policy]({repo}/blob/main/src/lib/policy.ts): independent creator, owner, recipient, resource, immutable deadline and chain expiry enforcement.
- [Discovery]({repo}/blob/main/src/app/api/discover/route.ts): project/kind partition and `.createdBy()` filtering.
- [Revocation]({repo}/blob/main/scripts/revoke.ts): issuer deletion, followed by fresh lookup denial.
- [Evidence collection]({repo}/blob/main/scripts/collect-evidence.ts): direct key-filtered JSON-RPC event recovery and successful receipt/block verification.

Wallet signatures, challenge nonces, Redis credentials and protected responses stay off-chain. Arkiv contains public synthetic wallet addresses and scope/time metadata only.

## Challenges encountered

Readonly storage can be extended by its owner, so storage retention cannot serve as the only immutable authorization deadline. We store a fixed deadline in readonly payload and enforce it independently. A real extension experiment confirmed signed access still denied after that deadline. Expired/deleted entities disappear from fresh queries, so we preserve separate creation/deletion hashes and block receipts. An unbounded historical log request hit an RPC range limit; bounded key-filtered requests recovered all existing creation hashes. Shared Redis atomic consumption prevents signature replay across function instances; a fresh production replay returned HTTP 403/challenge_used.

## Entity publishing wallets

- Trusted issuer / owner / revoker: `{issuer}`.
- Unauthorized attacker publisher: `{attacker}`.
- Showcase recipient, signatures only: `{decoded[0]['payload']['subject']}`. It does not publish Arkiv records in this workflow.
- Automated recipients are listed separately in lifecycle.json; their keys were ephemeral and discarded.

## Judge reproduction

1. Open the app and documentation without credentials. Select Trusted lease and Verify lease with vault-demo. Within the captured grant's live window it allowed; after expiry, denial is expected. The current key is available from /api/config.
2. Select Forged lease while it is live: actual creator differs and verification returns issuer_mismatch. Select analytics-demo against a live vault lease: resource_mismatch.
3. Inspect the [permanent evidence]({repo}/blob/main/docs/SECURITY_EVIDENCE.md) and explorer creation/deletion links. Entity keys and transaction hashes are separate.
4. For authenticated UI access, connect the actual recipient account using MetaMask, inspect the origin/key/resource challenge and sign. Public verification alone does not authenticate the viewer.
5. For full independent lifecycle reproduction, clone the MIT repository, install dependencies, configure fresh dedicated funded Tiramisu issuer/attacker wallets and shared Redis locally as documented. Use the existing issue/forge/revoke CLI with synthetic addresses. Never publish keys. The guarded lifecycle script demonstrates real extension/expiration/deletion against the existing production trust configuration only when run by its test issuer.
6. Run npm test and npm run build. Offline evidence checks: `node scripts/decode-evidence.mjs` and `node scripts/check-evidence.mjs`.

## Owner-only fields still requiring truthful completion

- Team members, Telegram/contact details, Indian nationality answer, registration state and payout address.
- Pre-existing work disclosure: README reports this MVP was built 14 October; owner must confirm whether any pre-9-October work was reused. Do not automatically attest None.
- Time from starting to first Arkiv entity, all LLMs used, feedback-call preference and attendance intention.
- Work ownership / eligibility declarations and public video URL.
- Final Devfolio submission and confirmation receipt. No submission or video upload is claimed here.

**Arkiv surfaces evidenced this session:** TypeScript SDK, Direct JSON-RPC, Docs, Block Explorer transaction references. Earlier Hub/Faucet use must be confirmed by the owner rather than inferred from wallet funding.

Working deadline: **18 October 2026, 23:59 Nigeria (22:59 UTC)**. Keep the app reachable through judging; short-lived examples need refreshing. Do not change the two-hour security policy to make examples permanent.

Official requirements: [submission checklist](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md). The final repository SHA and public video URL should be checked after push/upload.
'''
(docs / 'SUBMISSION.md').write_text(submission, encoding='utf-8')
print('Generated SECURITY_EVIDENCE.md, SUBMISSION.md and arkiv/friction.md from captured facts.')
