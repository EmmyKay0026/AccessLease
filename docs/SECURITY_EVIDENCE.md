# AccessLease security evidence — 18 October 2026

Verified against the deployed application, https://accesslease-three.vercel.app, and the public Arkiv Tiramisu RPC (chain ID 7738577). Capture window: **2026-10-18T06:13:31.339Z–2026-10-18T06:16:50.187Z** (07:13–07:16 Nigerian time). The existing application was not redeployed or changed.

Application source baseline: `c113f582cfc38e2bab2d4344df1a13ca5b2b7e0d`. Runtime: Node v22.13.1, Arkiv SDK 0.8.1, viem 2.57.7. These are measured versions from this checkout.

## Verified production behavior

These are fresh HTTP observations, separate from the historical manual results reported by the owner. Automated signatures used disposable in-memory EVM accounts and the production challenge service. No nonce, signature, private key, Redis token or credential-bearing URL is retained.

| Scenario | HTTP | Observed reason |
| --- | --- | --- |
| `authenticated-allow` | 200 | `allowed` |
| `authenticated-allow:replay` | 403 | `challenge_used` |
| `wrong-scope-public` | 200 | `resource_mismatch` |
| `wrong-scope-authenticated` | 403 | `resource_mismatch` |
| `wrong-recipient-authenticated` | 403 | `subject_mismatch` |
| `forged-public` | 200 | `issuer_mismatch` |
| `forged-authenticated` | 403 | `issuer_mismatch` |
| `wrong-origin` | 403 | `audience_mismatch` |
| `revoked-public` | 200 | `not_found` |
| `revoked-authenticated` | 403 | `not_found` |
| `before-deadline-authenticated` | 200 | `allowed` |
| `before-retention-expiry-authenticated` | 200 | `allowed` |
| `expired-deadline-public` | 200 | `deadline_passed` |
| `expired-deadline-authenticated` | 403 | `deadline_passed` |
| `expired-retention-public` | 200 | `not_found` |
| `expired-retention-authenticated` | 403 | `not_found` |

Public `/api/verify` returns HTTP 200 for a completed policy decision, including a denial; authenticated JSON `/api/access` returns HTTP 403 for denied access. Every captured denial lacked protected `data`. Successful requests returned the explicitly synthetic incident vault report. `Cache-Control: no-store` was captured on the verification and access responses.

The replay response followed a successful request using the exact same in-memory signed body. It returned HTTP 403 and `challenge_used`. New challenges were obtained for subsequent permission tests.

## Existing real Arkiv entities

Trusted issuer: `0xCe09547FEf1362b3711f17747096dCde2535a130`. Attacker: `0x5D56708455378d2287464F705D410261b23C08EA`. Shared showcase recipient: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`. The recipient is a public test address. Every grant below scopes access to `vault-demo`.

Creation transactions were recovered using key-filtered `eth_getLogs` against the Arkiv system address `0x4400000000000000000000000000000000000044`, decoded with the installed SDK ABI, and cross-checked against transaction senders, successful receipts and block timestamps. An entity key is **not** its transaction hash.

### local-trusted

- Entity key: `0xd7129a9024db92da0898337d6c15e53f4639e690d0acb60f1ee619fc17549f8d`.
- Creation transaction: [`0xe90154f87b7a61baf6d22a6e5b05017fc2aae92dd4cef49f62f40671cae479fd`](https://tiramisu.explorer.arkiv.network/tx/0xe90154f87b7a61baf6d22a6e5b05017fc2aae92dd4cef49f62f40671cae479fd).
- Creation block: **685671**; block timestamp: **2026-10-17T07:11:48.000Z**.
- Creation transaction sender: `0xce09547fef1362b3711f17747096dcde2535a130`; initial owner from `EntityCreated`: `0xCe09547FEf1362b3711f17747096dCde2535a130`.
- Live `$creator`: `unavailable: entity absent at verification`; live owner: `unavailable: entity absent at verification`.
- Subject: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`; resource: `vault-demo`.
- Issuer-authored issuance time: `2026-10-17T07:11:42.358Z`. This is payload metadata, not a consensus timestamp.
- Fixed authorization deadline: **2026-10-17T09:11:42.358Z** / **2026-10-17T10:11:42.358+01:00 Nigerian time**.
- Original chain expiry: block **689271**. Creation flag byte **1**: `readonly=true`, `permissionlessExtension=false`.
- Status at `2026-10-18T06:14:37.753Z`: **absent**; public result: `not_found`.

### local-forged

- Entity key: `0xc2c4b6dd3d30eee93d4b6a453d04573b4aec63b527d0d4d05b584c3c45148cc0`.
- Creation transaction: [`0x592669147e79dae1220e6e8912dbdca28ef9976366208a8573318fbc7fa892e7`](https://tiramisu.explorer.arkiv.network/tx/0x592669147e79dae1220e6e8912dbdca28ef9976366208a8573318fbc7fa892e7).
- Creation block: **685693**; block timestamp: **2026-10-17T07:12:32.000Z**.
- Creation transaction sender: `0x5d56708455378d2287464f705d410261b23c08ea`; initial owner from `EntityCreated`: `0x5D56708455378d2287464F705D410261b23C08EA`.
- Live `$creator`: `unavailable: entity absent at verification`; live owner: `unavailable: entity absent at verification`.
- Subject: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`; resource: `vault-demo`.
- Issuer-authored issuance time: `2026-10-17T07:12:28.286Z`. This is payload metadata, not a consensus timestamp.
- Fixed authorization deadline: **2026-10-17T09:12:28.286Z** / **2026-10-17T10:12:28.286+01:00 Nigerian time**.
- Original chain expiry: block **689293**. Creation flag byte **1**: `readonly=true`, `permissionlessExtension=false`.
- Status at `2026-10-18T06:14:42.066Z`: **absent**; public result: `not_found`.

### production-trusted

- Entity key: `0x4442961b028d0a06ef99a9c2180e83c3ed575b3640fe77d75fbfc10eb99e08d6`.
- Creation transaction: [`0x3de71dfae34c5f9ae622c7a04e8c7d186416c137169864e97c54afcb4baa881b`](https://tiramisu.explorer.arkiv.network/tx/0x3de71dfae34c5f9ae622c7a04e8c7d186416c137169864e97c54afcb4baa881b).
- Creation block: **725598**; block timestamp: **2026-10-18T05:22:42.000Z**.
- Creation transaction sender: `0xce09547fef1362b3711f17747096dcde2535a130`; initial owner from `EntityCreated`: `0xCe09547FEf1362b3711f17747096dCde2535a130`.
- Live `$creator`: `0xCe09547FEf1362b3711f17747096dCde2535a130`; live owner: `0xCe09547FEf1362b3711f17747096dCde2535a130`.
- Subject: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`; resource: `vault-demo`.
- Issuer-authored issuance time: `2026-10-18T05:22:36.061Z`. This is payload metadata, not a consensus timestamp.
- Fixed authorization deadline: **2026-10-18T07:22:36.061Z** / **2026-10-18T08:22:36.061+01:00 Nigerian time**.
- Original chain expiry: block **729198**. Creation flag byte **1**: `readonly=true`, `permissionlessExtension=false`.
- Status at `2026-10-18T06:14:44.459Z`: **present**; public result: `allowed`.

### production-forged

- Entity key: `0x38ed7691584de4e98e103f7a057cc95855684ca34dceea6abcd7a2b8b4cd8c13`.
- Creation transaction: [`0xe9d4dc9ae94b8c885100647da6c50dbb3c4906aefe5769af4c6e229c5caa6242`](https://tiramisu.explorer.arkiv.network/tx/0xe9d4dc9ae94b8c885100647da6c50dbb3c4906aefe5769af4c6e229c5caa6242).
- Creation block: **725629**; block timestamp: **2026-10-18T05:23:44.000Z**.
- Creation transaction sender: `0x5d56708455378d2287464f705d410261b23c08ea`; initial owner from `EntityCreated`: `0x5D56708455378d2287464F705D410261b23C08EA`.
- Live `$creator`: `0x5D56708455378d2287464F705D410261b23C08EA`; live owner: `0x5D56708455378d2287464F705D410261b23C08EA`.
- Subject: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`; resource: `vault-demo`.
- Issuer-authored issuance time: `2026-10-18T05:23:37.591Z`. This is payload metadata, not a consensus timestamp.
- Fixed authorization deadline: **2026-10-18T07:23:37.591Z** / **2026-10-18T08:23:37.591+01:00 Nigerian time**.
- Original chain expiry: block **729229**. Creation flag byte **1**: `readonly=true`, `permissionlessExtension=false`.
- Status at `2026-10-18T06:14:47.499Z`: **present**; public result: `issuer_mismatch`.

For absent historical entities, the original publisher, payload and flags were recovered from confirmed creation events and calldata. A fresh `$creator`/owner lookup is unavailable after expiry; absence alone does not prove whether a record expired or was deleted. Their recorded chain expiry and elapsed deadline establish that their original authorization window ended. For the two present production entities, SDK `$creator` values independently matched their creation transaction senders.

The forged entity copies the project, kind, subject and resource fields, but its actual creator is the attacker. The public and authenticated verifiers both returned `issuer_mismatch` while that entity was present.

## Real revocation and expiration

Exactly three new disposable entities were created by the trusted test issuer. One was deleted, and one had storage retention extended. The deployed showcase entities were not deleted or modified. Five new transactions were confirmed successfully.

| Operation | Entity key | Transaction | Block | Block timestamp (UTC) |
| --- | --- | --- | --- | --- |
| revocation-fixture | `0x2a0f74d3b124c9ceba41688a25430e194081babe93ea37a8e6d2d7e9975cb6d9` | [`0xda1cdb932551533f762b12e7fed0db219d01e3e40c75ae6bb36fc43a42c2ef29`](https://tiramisu.explorer.arkiv.network/tx/0xda1cdb932551533f762b12e7fed0db219d01e3e40c75ae6bb36fc43a42c2ef29) | 727127 | 2026-10-18T06:13:40.000Z |
| delete-revocation-fixture | `0x2a0f74d3b124c9ceba41688a25430e194081babe93ea37a8e6d2d7e9975cb6d9` | [`0xb2806a1b4b4cac6fcf680f8299cbbc7f501e3878f014c0568c1614851bdbc3b7`](https://tiramisu.explorer.arkiv.network/tx/0xb2806a1b4b4cac6fcf680f8299cbbc7f501e3878f014c0568c1614851bdbc3b7) | 727137 | 2026-10-18T06:14:00.000Z |
| deadline-fixture | `0x52be4b92b9778ec3a99e76cde817f512cd2b610078d4b9f4294d05dc9e4f89aa` | [`0x193e389467a0bccea0c21d5753918e06e6d57a93a12fbe5937f49ed2bf1e1c94`](https://tiramisu.explorer.arkiv.network/tx/0x193e389467a0bccea0c21d5753918e06e6d57a93a12fbe5937f49ed2bf1e1c94) | 727178 | 2026-10-18T06:15:22.000Z |
| extend-deadline-fixture-storage | `0x52be4b92b9778ec3a99e76cde817f512cd2b610078d4b9f4294d05dc9e4f89aa` | [`0x62e9235488cc96eb94bf6d975d253af7a8a1efd9d279ddd76ee2885c31352961`](https://tiramisu.explorer.arkiv.network/tx/0x62e9235488cc96eb94bf6d975d253af7a8a1efd9d279ddd76ee2885c31352961) | 727185 | 2026-10-18T06:15:36.000Z |
| retention-fixture | `0x58ea1c95342387420cadc4a09295a6464771035b09aedda3b9dc226896b02627` | [`0x203c8798d258ecd3ed6d439470fbb1b1eb6c7d124bafe0f4022bbf94a10655af`](https://tiramisu.explorer.arkiv.network/tx/0x203c8798d258ecd3ed6d439470fbb1b1eb6c7d124bafe0f4022bbf94a10655af) | 727187 | 2026-10-18T06:15:40.000Z |

### revocation-fixture

Entity: `0x2a0f74d3b124c9ceba41688a25430e194081babe93ea37a8e6d2d7e9975cb6d9`. Live creator and owner: `0xCe09547FEf1362b3711f17747096dCde2535a130`. Subject: `0xD5C95a39139A0CD48e35aE05b54f0Bca4c5E0830`; scope: `vault-demo`. Flags: `readonly=true`, `permissionlessExtension=false`.

Fixed deadline: `2026-10-18T06:33:35.494Z`. Initial chain expiry: `727727`. It was present and locally allowed before its lifecycle check; authenticated access also succeeded before deletion/expiry.


### deadline-fixture

Entity: `0x52be4b92b9778ec3a99e76cde817f512cd2b610078d4b9f4294d05dc9e4f89aa`. Live creator and owner: `0xCe09547FEf1362b3711f17747096dCde2535a130`. Subject: `0x9b496743D35B9Ff61C2E15458a6b0c2Bf7662a0F`; scope: `vault-demo`. Flags: `readonly=true`, `permissionlessExtension=false`.

Fixed deadline: `2026-10-18T06:16:18.570Z`. Initial chain expiry: `727208`. It was present and locally allowed before its lifecycle check; authenticated access also succeeded before deletion/expiry.


### retention-fixture

Entity: `0x58ea1c95342387420cadc4a09295a6464771035b09aedda3b9dc226896b02627`. Live creator and owner: `0xCe09547FEf1362b3711f17747096dCde2535a130`. Subject: `0x9b496743D35B9Ff61C2E15458a6b0c2Bf7662a0F`; scope: `vault-demo`. Flags: `readonly=true`, `permissionlessExtension=false`.

Fixed deadline: `2026-10-18T06:16:37.469Z`. Initial chain expiry: `727217`. It was present and locally allowed before its lifecycle check; authenticated access also succeeded before deletion/expiry.

### What the lifecycle observations establish

1. **Revocation:** the revocation fixture granted signed access, then a confirmed `EntityDeleted` event was recorded. A new SDK lookup found no entity; a new public verification returned `not_found`; a newly signed authenticated request returned **403/not_found**. This is deletion evidence, not an inference from absence alone.
2. **Fixed deadline after storage extension:** the owner extended the read-only deadline fixture from expiry block **727208** to **727485**. The complete parsed payload was identical before extension and after the deadline. At head **727217**, the entity remained present and below its chain expiry, but public verification and authenticated access denied with `deadline_passed` (**403** on access).
3. **Arkiv retention expiration:** a separate 60-second lease allowed authenticated access before expiration. After real time and the corresponding chain expiry, `getEntity` returned `NoEntityFoundError`; public verification denied and a newly signed request returned **403/not_found**. Its event history contains creation and no explicit deletion or extension. No expiry event was required for enforcement.

The controller waited for real wall-clock time and live chain height. It did not mock time, alter gateway policy, change Redis configuration or redeploy production.

## Evidence files and reproduction

- [`baseline.json`](../arkiv/evidence/2026-10-18/baseline.json): public config, HTTP page/discovery checks, four SDK observations, creation logs, calldata and receipts.
- [`decoded-creations.json`](../arkiv/evidence/2026-10-18/decoded-creations.json): decoded historical/public creation payloads, clearly separated from current live state.
- [`lifecycle.json`](../arkiv/evidence/2026-10-18/lifecycle.json): transaction receipts, before/after on-chain snapshots and redacted production HTTP results.
- [`validation.json`](../arkiv/evidence/2026-10-18/validation.json): offline assertions covering 16 production outcomes, four existing creation receipts, five new lifecycle receipts and fixed-deadline preservation.
- [`rpc-and-explorer.json`](../arkiv/evidence/2026-10-18/rpc-and-explorer.json): exact `query exceeds max block range 100000` error and HTTP 200 checks for both production creation transaction explorer URLs.
- [`QA_RESULTS.md`](QA_RESULTS.md): current automated suite/build/audit results and browser limitations.
- [`DEMO.md`](DEMO.md): three-minute script, video description and recording handoff.

Read-only collection (writes local evidence files, not on-chain state):

```powershell
node --env-file=.env --import tsx scripts/collect-evidence.ts
node scripts/decode-evidence.mjs
node scripts/check-evidence.mjs
```

Archive an existing capture before intentionally collecting a different dated run. The scripts currently target the 18 October evidence directory; preserve this submitted snapshot. `check-evidence.mjs` makes no network requests.

The lifecycle script submits transactions and is deliberately guarded against repeating an existing run. To reproduce with fresh dedicated wallets in a separate checkout/capture directory: configure issuer credentials locally, then run `node --env-file=.env --import tsx scripts/lifecycle-evidence.ts --transact`. It generates recipients only in memory, issues three fixtures, confirms deletion/extension, signs production challenges and waits for real expiry. It never prints private keys or persists signed request bodies. The documented `--resume-expiration` mode was used once after an evidence log query exceeded the RPC range limit; already completed issuance/deletion checks were preserved, and the second recipient is separately recorded.

## Scope and remaining operator work

Fresh production wallet authentication here used viem/EIP-191 signatures. **MetaMask extension UI was not reverified in this session.** The owner previously reported a successful MetaMask run; that remains a historical report. Browser helpers returned `FrameArrived timed out` and `get_window_state` timeout; no screenshot or wallet interaction is claimed.

Production `/` and `/docs` returned HTTP 200, expected titles and Lucide markup. This verifies served HTML, not responsive rendering, hydration or wallet-provider selection. The latest source contains EIP-6963 selection, exact origin binding, random two-minute challenges and shared Redis atomic consumption, with 75 automated tests covering policy/authentication/wallet behavior.

No on-chain read-only patch attack or forced production RPC/Redis outage was performed. Fail-closed outage behavior is covered locally; do not describe those cases as live production experiments. This is a synthetic MVP without production abuse controls or a perpetual authorization/audit service.

The captured production trusted sample authorization ends at **2026-10-18T08:22:36.061+01:00 Nigerian time**. It will deny after that window. Refresh disposable examples near recording/judging using the existing CLI; extending storage cannot extend authorization. Do not promise permanent live access from a two-hour grant.

The local MP4 is an evidence walkthrough of captured results, not a live browser/MetaMask screen recording. Upload a publicly accessible video and finish the Devfolio form separately. Owner-only team declarations and final submission status must be confirmed by the owner. Working submission cutoff: **18 October 2026, 23:59 Africa/Lagos (22:59 UTC)**.
