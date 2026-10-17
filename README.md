# AccessLease

> Grant temporary access. Verify every permission. Trust no expired lease.

AccessLease is a **security-track hackathon MVP**, built 14 October 2026 for the [Arkiv Global Tour](https://arkiv.devfolio.co/). It enforces synthetic-resource permissions backed by read-only Arkiv Tiramisu entities and verifies the *actual on-chain creator*, not a forgeable issuer field.

## Current implementation state

- ✅ Next.js frontend: public verification, Arkiv-powered discovery, wallet-signed synthetic-resource access.
- ✅ Server-side policy: trusted `$creator` and `$owner`, read-only flags, scoped subject and resource, separate immutable deadline, live block check, fail-closed behavior.
- ✅ Admin CLI: grant, impersonation attack, revoke.
- ✅ Expanded policy, signature, replay, API and wallet-flow tests; see the completion report for final counts.
- ✅ Production build and a read-only Tiramisu sample-policy check verified on 17 October 2026. Actual MetaMask signing against shared Redis still requires operator setup and manual verification; no transactions were submitted.
- ⚠️ Demo only. Not a production authorization provider. See security limits below.

## Requirements

- Node.js 22+, npm.
- Fresh dedicated test EVM wallets, never personal wallets.
- Tiramisu test GLM via [Arkiv Hub](https://hub.arkiv.network/) for issuer and attacker publishing wallets.
- Public RPC or an optional server-side RPC access-key URL.

## Setup (Windows PowerShell)

```powershell
npm install
# For a fresh checkout only; preserve your existing .env if it already exists.
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Create two **new test-only wallets**. For example, after `npm install`:

```powershell
node --input-type=module -e "import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts'; const k=generatePrivateKey(); console.log('ADDRESS:',privateKeyToAccount(k).address); console.log('PRIVATE KEY (KEEP LOCAL):',k)"
```

Run the command separately for the issuer and attacker. Create/select a third disposable wallet as the *recipient*; its address can be copied from the wallet UI. NEVER paste the keys into chat or GitHub. Set the private keys in `.env` (which is gitignored), and the trusted issuer *address* in `ARKIV_ISSUER_ADDRESS`.

Fund **issuer and attacker** test wallets with Tiramisu test GLM from the faucet. The recipient needs only to sign, not send transactions.

Issue a short-lived authorization for the **recipient** test address:

```powershell
npm run lease:issue -- --subject=0xRECIPIENT_WALLET_ADDRESS --resource=vault-demo --minutes=20
```

Copy the returned `entityKey` into `SAMPLE_VALID_LEASE_KEY` in `.env`. **Never** use example placeholders as real addresses.

Publish an attacker's superficially identical lease:

```powershell
npm run lease:forge -- --subject=0xRECIPIENT_WALLET_ADDRESS --resource=vault-demo --minutes=20
```

Copy its key into `SAMPLE_FORGED_LEASE_KEY`. Confirm that the issuer and attacker wallets differ.

Configure the required shared Redis database and exact application origin using [Authentication setup and manual verification](docs/AUTHENTICATION.md). Existing wallet keys can remain in place.

Run the app:

```powershell
npm run test
npm run dev
```

Open http://localhost:3000. Use **Trusted lease**, **Forged lease**, **Discover live**, or provide an Arkiv entity key manually. To retrieve the synthetic resource, select the actual recipient test account in MetaMask, choose **MetaMask** in the page wallet selector, and select **Request access**. Phantom may remain enabled. The gateway verifies the signature, subject, scope, creator, flags and expiration.

To revoke (while a lease is still alive):

```powershell
npm run lease:revoke -- --key=0xENTITY_KEY_TO_REVOKE
```

Check it again after the deletion transaction is confirmed: it must deny. To test deadline expiry, create a 1-minute lease and check after the minute passes. Grant publication returns a transaction hash and entity key for reproducibility; preserve both in your submission evidence.

## Deployment

Deploy to Vercel or another Next.js Node host. Set *server-side* environment variables in the deployment:

- `ARKIV_ISSUER_ADDRESS` (required)
- `ACCESSLEASE_ORIGIN` (required fixed HTTPS production origin)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required shared writable Redis REST configuration)
- `ARKIV_RPC_URL` (optional; keep access-key URLs server-side)
- `SAMPLE_VALID_LEASE_KEY`, `SAMPLE_FORGED_LEASE_KEY` (optional public data)

**Do not upload private keys to the deployment.** The deploy only reads Arkiv; run grant/revoke CLI locally with private keys in your private `.env`.

Make sure at least one lease remains live for judging, and that the deployed app loads without credentials. Due to short leases, publish new synthetic examples shortly before recording and provide transaction evidence that survives expiry. No real data is gated by this MVP.

## Architecture

```text
ADMIN TEST WALLET                     PUBLIC TEST WALLET
       |                                      |
       | createEntity() [readonly]            | personal_sign
       v                                      v
 Arkiv Tiramisu    <----------  Next.js API /access
     |    ^                getEntity(), getBlockNumber()
     |    |                          |
     | /api/discover                 v
     v                        VERIFY POLICY
Public verifier             creator == trusted issuer?
/api/verify                 owner == trusted issuer?
                            immutable + correct scope?
                            current block < chain expiry?
                            now < immutable deadline?
                            signature subject == grantee?
                                   |
                              synthetic text only
```

## Security model

- **Root of trust:** An operator-configured *public issuer address*. A payload's claim of authorship is never trusted. Public observers can query `$creator` directly from Arkiv without the gateway.
- **Identity:** End-users sign a purpose-bound EIP-191 wallet message. The gateway verifies the signature's recovered address before checking whether the signed wallet is the recorded recipient.
- **Scope:** Each lease names exactly one synthetic resource.
- **Immutability:** `readonly: true` freezes the payload and attributes. Gateway also enforces the unchanged owner and disallows permissionless extension.
- **Expiry:** Two independent cutoffs: chain expiry *and* immutable `deadlineMs`. Owner-controlled Arkiv retention extensions do **not** enlarge authorization.
- **Revocation:** Issuer deletes entity; a fresh on-chain lookup fails. Unreachable RPC also fails closed.
- **No secrets on-chain:** All data is synthetic, public, and non-sensitive.

### Known security limits — read before any production use

1. Each protected fetch now uses a server-generated two-minute challenge and shared Redis atomic single-use consumption. Redis and an exact application origin must be configured; no process-memory fallback exists. This remains a synthetic demonstration without persistent sessions or production abuse controls. See [authentication details](docs/AUTHENTICATION.md).
2. HTTP RPC freshness and application-server/Redis clock accuracy affect permission checks. Browser clock drift does not affect authentication. A production gateway needs chain-finality assumptions, clock tolerance definitions, read consistency/retry policy, auditing, and rate limiting.
3. No smart contracts or real services are protected; responses are obviously labelled *SYNTHETIC*.
4. A trusted administrator can issue and delete leases. Key compromise remains out of scope; immutable records cannot compensate for compromise of the trusted issuer.
5. On-chain absence (after deletion/expiry) makes access fail closed but does **not** itself provide an immutable lifetime audit trail. Save the grant and deletion transaction hashes in the demo evidence.
6. Public-chain data is public and should not contain personal data. Use disposable synthetic recipient wallets.

## Project structure

```text
src/app/page.tsx            Public dashboard and wallet interaction
src/app/api/discover/       Creator-filtered Arkiv discovery
src/app/api/verify/         Public verification endpoint
src/app/api/challenge/      Server-generated audience-bound challenge
src/app/api/access/         Single-use authenticated synthetic-resource endpoint
src/lib/challenge-store.ts  Shared Redis REST storage and atomic consume
src/lib/auth.ts             Canonical challenge validation and signature recovery
src/lib/access-client.ts    Bounded wallet flow and UI state cleanup
src/lib/wallet.ts           EIP-6963 provider selection and account events
src/lib/policy.ts           Deterministic, unit-tested authorization policy
src/lib/arkiv.ts            Live Arkiv reads and entity mapping
src/lib/messages.ts         Purpose-bound wallet signing format
scripts/issue.ts            Publisher and attacker CLI
scripts/revoke.ts           Immediate revocation CLI
arkiv/schema.md             Required Arkiv entity/query contract
arkiv/friction.md           Required factual implementation friction report
docs/DEMO.md                Three-minute demo guide
tests/*.test.ts             Policy, signatures, API/SDK and wallet-flow coverage
docs/AUTHENTICATION.md     Shared infrastructure and manual verification
docs/COMPLETION_REPORT.md  Fixes, results and remaining verification limits
```

## Hackathon checklist

- [x] MIT licence, repo-ready source code, setup instructions
- [x] `/arkiv/schema.md`
- [x] `/arkiv/friction.md` with transparent pending network experiments
- [x] Security-track code using immutable creator verification
- [x] Local automated policy tests
- [x] `npm install` + `npm run build` executed successfully
- [ ] Live creation, read, forged-creator denial, revocation on Tiramisu independently verified
- [ ] On-chain issuer and attacker addresses and transaction hashes recorded
- [ ] Public deployment accessible without credentials
- [ ] Reproduction from public app verified
- [ ] <= 3 minute video published
- [ ] Devfolio form completed by October 18, 2026, 23:59 Nigeria time

**Official references:** [Arkiv hackathon rules](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon), [SDK docs](https://docs.arkiv.network/), [security scoring rubric](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/scoring-rubric.md).
