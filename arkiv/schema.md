# AccessLease Arkiv data contract (v1)

Network: **Tiramisu** (`7738577`), SDK: `@arkiv-network/sdk` 0.8.x.

## Entity: `lease`

Created with `createEntity()` by a trusted administrator test wallet.

| Field | Storage | Type | Purpose |
|---|---|---|---|
| `project` | attribute | `str` | `accesslease-2026-v1` partition (NOT an authentication mechanism) |
| `kind` | attribute | `str` | `lease` |
| `resource` | attribute | `str` | `vault-demo` or `analytics-demo` searchable scope |
| `subject` | attribute | `str` | Synthetic test-wallet address only |
| `schema` | JSON payload | string | Exactly `accesslease/v1` |
| `subject` | JSON payload | address | Recipient's test wallet |
| `resource` | JSON payload | enum | Authorized resource |
| `issuedAtMs` | JSON payload | integer | Issuer-supplied issuance time |
| `notBeforeMs` | JSON payload | integer | Earliest allowed access time |
| `deadlineMs` | JSON payload | integer | **Immutable access cutoff** in ms |
| `$creator` | system | address | Authenticated original publisher; cannot be forged via attributes |
| `$owner` | system | address | Must still equal trusted issuer |
| `$expiresAt` | system | u64 block | Arkiv retention cutoff; may be extended by owner |
| `creationFlags` | system | flags | Must be `readonly=true`, `permissionlessExtension=false` |

### Lifetime

The CLI issues 1–120 minute leases. It sets Arkiv lifetime to the same nominal duration as the authorization deadline. Access requires both conditions: `currentHead < $expiresAt` **and** `nowMs < deadlineMs`. Extending an entity's retention cannot extend the hard deadline, even though Arkiv allows the owner to extend a read-only entity. An entity can be deleted early for immediate revocation (subject to chain inclusion / read consistency).

### Queries the application actually performs

**1. Direct live verification:** `publicClient.getEntity(entityKey)` loads creator, owner, flags, payload, expiry and `getBlockNumber()` supplies the chain head. Server then applies `evaluateLease()` policy. It never trusts a client-supplied `issuer` field.

**2. Discover trusted leases:**

```ts
client.select({ key: true, creator: true, payload: true })
  .where(eq('project', str('accesslease-2026-v1')),
         eq('kind', str('lease')))
  .createdBy(TRUSTED_ISSUER_ADDRESS)
  .limit(30).fetch()
```

In query language, equivalent logical filter:

```text
project = str('accesslease-2026-v1') AND kind = str('lease') AND $creator = addr('TRUSTED_ISSUER_ADDRESS')
```

The actual SDK query should be re-run against Tiramisu after test wallet publication; do not assume results exist before seeding.

### What stays off Arkiv

Private signing keys, authentication signatures, gateway responses, real personal information, API credentials, session state, and real protected resources. The public test subject is a synthetic wallet only.

### Revocation

Trusted issuer calls `deleteEntity()`. The protected-resource gateway re-fetches on each access and denies if the entity is absent. Do not cache successful authorization decisions.
