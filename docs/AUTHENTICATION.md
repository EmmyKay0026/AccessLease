# Authentication setup and verification

The access gateway requires a shared Upstash Redis database. It never substitutes process memory or sample authorization when infrastructure fails. Public lease verification and discovery remain available without Redis.

1. Create a dedicated Upstash Redis database through the Vercel project's **Storage / Marketplace** integration, or connect an existing dedicated Upstash database. Use a separate database for development/preview and production. Use a persistent database with eviction disabled and restrict its writable credentials to this server.
2. Add the server-only variables below to your private local environment and, when you choose to deploy, to the appropriate Vercel environment. Do not put them under `NEXT_PUBLIC_`. Do not overwrite existing wallet keys. This change does not provision infrastructure or deploy.
3. Restart the server after adding configuration.

| Variable | Value |
| --- | --- |
| `ACCESSLEASE_ORIGIN` | Exact browser origin, such as `http://localhost:3000` locally or `https://your-domain.example` in production. Include a non-default port, omit paths. Required in production; development only can infer a loopback origin. Configure previews separately. |
| `UPSTASH_REDIS_REST_URL` | Database's HTTPS REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only writable REST token supporting SET, GET, EVAL, TIME and DEL. A read-only token cannot work. |
| `ARKIV_ISSUER_ADDRESS` | Existing trusted public issuer address. |
| `ARKIV_RPC_URL` | Optional existing server-only Tiramisu endpoint. |
| `SAMPLE_VALID_LEASE_KEY`, `SAMPLE_FORGED_LEASE_KEY` | Optional existing public showcase entity keys. |

Issuer and attacker private keys are needed only for the existing local grant/revoke CLI. They are never needed by the gateway. The existing `.env` was not changed.

The Redis implementation uses the documented [REST command-array API](https://upstash.com/docs/redis/features/restapi) and an atomic [Lua EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval). It stores a 256-bit random nonce and the canonical challenge for three minutes; the signature deadline is strictly two minutes. The final minute exists only to return a useful expiry message. EVAL compares the entire stored challenge, checks Redis time against the deadline and deletes the record in one operation. A consumed nonce cannot be retried, including after a failed Arkiv read. Obtain a new challenge for every retry. Ambiguous storage operations are never retried automatically.

Both application servers and Redis must have accurate clocks. The browser clock is not used for authentication. The domain comes from fixed configuration in production, not forwarded host headers. Both POST routes require an exact matching Origin header. Non-browser clients must supply it explicitly.

The page requests announced providers using [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963). Choose MetaMask explicitly. Phantom can remain enabled and is shown as unsupported. There is no automatic fallback to the ambiguous `window.ethereum` object. Use a current MetaMask extension that announces EIP-6963 providers. Provider metadata is self-attested, not cryptographic proof of an extension's identity; only install extensions you trust. Unknown wallet icons are not rendered.

**Manual successful access**

1. Configure Redis and the origin above. Run `npm install`, `npm test`, then `npm run dev`. Open the exact configured origin.
2. Keep MetaMask and Phantom enabled. Unlock MetaMask and select the disposable recipient account named in an active trusted lease.
3. Paste that lease's entity key and select its resource. Click **Verify lease**. Expect the trusted creator, recipient and fixed deadline, with permission verified.
4. Select **MetaMask** under **Sign with wallet**. Click **Request access** and approve the connection in MetaMask.
5. Inspect the signing message: the origin, recipient address, lease key, resource, nonce, issue time and expiration must match this request. Approve within two minutes. This is a signature, not a transaction; the recipient does not need GLM.
6. Expect **Connecting wallet**, **Awaiting signature**, **Verifying signature**, **Checking Arkiv permission**, then **Access granted**, followed by synthetic vault or analytics text. The last two server stages arrive over NDJSON; a normal JSON client can omit the NDJSON Accept header.
7. If there is no active lease, stop and arrange issuance separately. The existing issuance and revocation scripts submit transactions; run them only when you have chosen to authorize those operations. No lease was issued or revoked during this fix.

**Manual denials and recovery**

- Cancel connection: expect **Wallet connection cancelled**, and an enabled retry button. Reject a signature: expect **Signature request rejected**.
- Leave the signature prompt open for more than two minutes, then approve or close it. The UI must terminate its wait, and a stale challenge must not grant data. MetaMask requests cannot be cancelled by the application: close any still-open prompt before retrying.
- Switch MetaMask accounts while signing or checking permission. Expect cancellation/denial and cleared protected data. Switch again after a grant; the old data must disappear. Disconnect or lock the wallet; clear the account and result.
- Use a different wallet address, an analytics lease for the vault, a forged issuer lease, an expired permission, or a revoked/deleted lease. Each must deny access without data.
- In browser DevTools Network, retain the JSON request payload from a successful `/api/access` POST. Resubmit exactly that payload to `/api/access` from the same origin (for example via DevTools Copy as fetch). Expect HTTP 403 and `challenge_used`. Altering the resource or lease key on an unused signed challenge must also deny.
- Temporarily use browser DevTools offline/request blocking for `/api/challenge` or `/api/access`. Expect safe failure or a request timeout, an enabled retry button, and no protected data. Restore connectivity before retrying.
- To exercise an actual Arkiv outage, use a temporary development RPC override and restart. Expect a final `arkiv_unavailable` denial. Restore the existing endpoint afterward; do not alter wallet configuration.

Network reads time out after 25 seconds including response-body streaming. Connection/account RPC calls wait at most 30 seconds; signature approval waits at most two minutes. Each Arkiv RPC has an eight-second transport timeout with no retries. UI cleanup always runs in finally. Late wallet resolutions are ignored. Native wallet prompts may still require dismissal.

**Security boundaries and remaining limits**

Signature verification, single-use consumption, trusted on-chain creator and owner, read-only flags, resource, recipient, start/issuance times, chain expiration and the immutable permission deadline are all enforced server-side. Every protected response gets a new live authorization check. No session or persistent authorization cache is introduced.

HTTP RPC responses remain trusted inputs: finality, consistency and a deletion racing an in-flight read are existing deployment considerations. Add shared rate limiting and operational monitoring before exposing this demonstration as a general production authorization service. Protected data remains synthetic.
