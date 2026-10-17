# Arkiv implementation friction log

> This file is a factual log. **Do not invent issues, successful on-chain transactions, or test results.** Fill the network evidence fields only after performing the corresponding experiment.

## Local (verified on 14 October 2026)

- Runtime: Node 22.16.0, npm 10.9.2.
- `npm test`: 12 policy test cases passed (pure TypeScript, independent of RPC).
- Arkiv SDK installation: **not yet run in this environment** (registry access timed out).
- Live Tiramisu entity creation/read and wallet operations: **not yet run**.

## Documentation-level findings (not claimed as measured runtime bugs)

### F-01: Read-only does not pin the expiry

- Surface: Docs → Mutating data → Creation flags / Lifetime extension.
- Expected for our application: An access cutoff fixed when the authorization is issued.
- Documented behavior: An owner can extend the lifetime of a `readonly` entity. The flag freezes only attributes and payload.
- Product response: Encode `deadlineMs` in the immutable payload and check it separately from `$expiresAt`.
- Reproduce: Create a `readonly` entity and call `extendEntity()` as the owner. Inspect `$expiresAt` and confirm the immutable payload did not change.
- Observed Tiramisu result: **PENDING**.
- Improvement suggestion: Add a prominent security note explaining that `readonly` is not an immutable expiration policy.

### F-02: Expiration has no event

- Surface: Docs → Fundamentals → Expiration.
- Expected: A lease gate must reject expired records without relying on an event callback.
- Documented behavior: No expiry event is emitted; queries stop returning the entity when it expires.
- Product response: Read Arkiv for every synthetic protected-resource request and fail closed on missing/unavailable records.
- Reproduce: Create a short-lived test entity; query before and after its expiration.
- Observed Tiramisu result: **PENDING**.
- Improvement suggestion: Provide a canonical lease-check example covering RPC failures and block-height expiry.

## Live experiments required before submission

| Test | Expected | Actual | SDK/version | Entity key / TX hash |
|---|---|---|---|---|
| Trusted read-only grant | ALLOW for correct wallet/scope | PENDING | PENDING | PENDING |
| Wrong `$creator` with matching metadata | DENY | PENDING | PENDING | PENDING |
| Scope mismatch | DENY | PENDING | PENDING | PENDING |
| Deadline after Arkiv storage extension | DENY | PENDING | PENDING | PENDING |
| Revoke by deletion | DENY after confirmation | PENDING | PENDING | PENDING |
| Unreachable RPC | fail closed | PENDING | PENDING | n/a |

For each live experiment, record commands, expected vs actual, SDK/Node versions, the transaction/entity IDs, and the smallest reproduction steps. The judges award points for accurate friction reports, not fabricated complaints.
