# AccessLease — submission preparation

**Track:** Security (Global). **Tagline:** Grant temporary access. Verify every permission. Trust no expired lease.

**Live application:** https://accesslease-three.vercel.app/
**Documentation:** https://accesslease-three.vercel.app/docs
**Repository:** https://github.com/EmmyKay0026/AccessLease
**Schema:** https://github.com/EmmyKay0026/AccessLease/blob/main/arkiv/schema.md
**Friction report:** https://github.com/EmmyKay0026/AccessLease/blob/main/arkiv/friction.md
**Security evidence:** https://github.com/EmmyKay0026/AccessLease/blob/main/docs/SECURITY_EVIDENCE.md

These GitHub evidence links become available after the evidence commit is pushed. A local MP4 is prepared at `artifacts/demo/accesslease-evidence-demo.mp4`; the public hosted video URL remains an owner action. Do not submit a local path as the video URL.

## The problem it solves

Contractors and incident responders need temporary access to one resource. A copied permission document should not impersonate the trusted issuer, authorize a different wallet, outlive its deadline or survive revocation. AccessLease makes the grant publicly inspectable on Arkiv and requires the recipient to sign a purpose-bound, single-use challenge before the gateway returns an explicitly synthetic incident vault. Every protected fetch rechecks live permission state.

## Why Arkiv?

Arkiv exposes the actual immutable creator, owner, creation flags and finite entity lifetime independently of AccessLease's API. Postgres or our own API alone would let the operator supply unverifiable authorship claims; IPFS content addressing does not itself establish the trusted Arkiv publisher or current revocation state. A subgraph could index another authorization contract, but that would require a different issuing/enforcement system. Here Arkiv directly supplies the queryable lease evidence. The off-chain gateway still controls delivery and must be trusted to enforce policy; public evidence does not force an arbitrary server to behave honestly.

## How we use Arkiv

- [Issue CLI](https://github.com/EmmyKay0026/AccessLease/blob/main/scripts/issue.ts): synthetic recipient/resource attributes and readonly JSON payload with a fixed authorization deadline.
- [Live verifier](https://github.com/EmmyKay0026/AccessLease/blob/main/src/lib/arkiv.ts): getEntity plus fresh block height, actual creator/owner/flags and expiry checks.
- [Policy](https://github.com/EmmyKay0026/AccessLease/blob/main/src/lib/policy.ts): independent creator, owner, recipient, resource, immutable deadline and chain expiry enforcement.
- [Discovery](https://github.com/EmmyKay0026/AccessLease/blob/main/src/app/api/discover/route.ts): project/kind partition and `.createdBy()` filtering.
- [Revocation](https://github.com/EmmyKay0026/AccessLease/blob/main/scripts/revoke.ts): issuer deletion, followed by fresh lookup denial.
- [Evidence collection](https://github.com/EmmyKay0026/AccessLease/blob/main/scripts/collect-evidence.ts): direct key-filtered JSON-RPC event recovery and successful receipt/block verification.

Wallet signatures, challenge nonces, Redis credentials and protected responses stay off-chain. Arkiv contains public synthetic wallet addresses and scope/time metadata only.

## Challenges encountered

Readonly storage can be extended by its owner, so storage retention cannot serve as the only immutable authorization deadline. We store a fixed deadline in readonly payload and enforce it independently. A real extension experiment confirmed signed access still denied after that deadline. Expired/deleted entities disappear from fresh queries, so we preserve separate creation/deletion hashes and block receipts. An unbounded historical log request hit an RPC range limit; bounded key-filtered requests recovered all existing creation hashes. Shared Redis atomic consumption prevents signature replay across function instances; a fresh production replay returned HTTP 403/challenge_used.

## Entity publishing wallets

- Trusted issuer / owner / revoker: `0xCe09547FEf1362b3711f17747096dCde2535a130`.
- Unauthorized attacker publisher: `0x5D56708455378d2287464F705D410261b23C08EA`.
- Showcase recipient, signatures only: `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`. It does not publish Arkiv records in this workflow.
- Automated recipients are listed separately in lifecycle.json; their keys were ephemeral and discarded.

## Judge reproduction

1. Open the app and documentation without credentials. Select Trusted lease and Verify lease with vault-demo. Within the captured grant's live window it allowed; after expiry, denial is expected. The current key is available from /api/config.
2. Select Forged lease while it is live: actual creator differs and verification returns issuer_mismatch. Select analytics-demo against a live vault lease: resource_mismatch.
3. Inspect the [permanent evidence](https://github.com/EmmyKay0026/AccessLease/blob/main/docs/SECURITY_EVIDENCE.md) and explorer creation/deletion links. Entity keys and transaction hashes are separate.
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
