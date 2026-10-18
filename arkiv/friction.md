# Arkiv implementation friction — verified 18 October 2026

Measured environment: Node v22.13.1, Arkiv SDK 0.8.1, viem 2.57.7, Tiramisu chain ID 7738577. [Full evidence](../docs/SECURITY_EVIDENCE.md). These observations supersede the old pending network-experiment entries.

| Surface | Expected | Actual, with reproduction | Result |
| --- | --- | --- | --- |
| SDK create/getEntity | Immutable, scoped record with authoritative creator | Create a readonly lease with the existing CLI; getEntity exposes creator, owner, flags, createdAt and expiresAt. Four prior creation receipts recovered; three new grants confirmed. | Verified |
| Creator-filtered query | Only trusted issuer appears in discovery | GET /api/discover used `.createdBy(issuer)`; returned the trusted production grant and its block number. Copied project/subject/resource fields did not authenticate the attacker. | Verified |
| Authentic publisher | Forged metadata cannot impersonate issuer | The production forged grant's creator was `0x5D56708455378d2287464F705D410261b23C08EA`; public verification and signed access returned issuer_mismatch. | Verified |
| Readonly lifetime extension | Fixed access cutoff despite longer storage | Owner successfully extended a readonly entity's expiry from 727208 to 727485; immutable payload/deadline stayed unchanged. A later signed request denied deadline_passed while the entity remained live. | Verified |
| Expiration | Fresh reads stop returning expired entities | Create a 60-second lease, observe signed access, wait for wall clock and live chain height, then getEntity returns NoEntityFoundError and signed access returns 403/not_found. No expiry event is needed. | Verified |
| Deletion | Owner revocation denies immediately after inclusion/read | Delete only the new fixture. Successful receipt and EntityDeleted link the deletion to the same key; fresh signed request returns 403/not_found. | Verified |
| Direct JSON-RPC history | Recover creation transaction separately from entity key | An unbounded genesis-to-head eth_getLogs request returned InvalidParamsRpcError. Key-filtered backward windows of at most 100,000 blocks succeeded. `scripts/collect-evidence.ts` records raw logs, calldata, receipts and block timestamps. | Reproduced query limit |
| Entity history after expiry | Preserve enough evidence to audit issuance | Both old local sample keys were absent. Their creation logs, transaction senders and decoded payloads were recoverable from transaction history, but fresh system creator/owner reads were unavailable. | Verified limitation |

**Suggested improvement:** document that `readonly` freezes content, not the owner's ability to extend storage. Include an authorization example with an immutable application deadline and a fail-closed fresh lookup. Also document eth_getLogs range limits beside a small key-filtered history example, and clearly distinguish `createdAt` block height, consensus block timestamp and issuer-supplied payload time.

**Reproduce:** run the read-only collection and offline validation commands in [SECURITY_EVIDENCE.md](../docs/SECURITY_EVIDENCE.md). For new lifecycle experiments, use the guarded transaction script with dedicated testnet wallets. Commands, exact keys, hashes, versions and before/after values are in the evidence JSON.

**Not measured on-chain:** rejecting a patch to a readonly record. **Not induced in production:** RPC/Redis outage. Their source/unit coverage is not substituted for a live experiment. Browser/MetaMask capture was unavailable in this session. No SDK package installation failure is asserted as current behavior.
