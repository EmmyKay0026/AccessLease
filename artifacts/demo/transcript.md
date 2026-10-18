# AccessLease evidence video transcript

00:00 - Temporary permissions. Verifiable evidence.

AccessLease grants temporary, resource scoped permission backed by public Arkiv records. A contractor signs a single use wallet challenge before the gateway returns a synthetic incident vault. This evidence walkthrough uses real Tiramisu receipts and fresh production responses captured on October eighteenth. It is a narrated record of those observations, with no browser or MetaMask interaction claimed.

00:24 - Copied metadata cannot forge the creator.

These are the existing production examples. The trusted grant and forged grant use the same recipient and resource. Their on chain creators differ. AccessLease checks the actual creator and owner, rather than accepting an issuer claim inside copied metadata. The trusted sample was allowed. The attacker sample returned issuer mismatch. Each entity key is linked to its separate creation transaction through the Entity Created event, successful receipt, and block timestamp.

00:56 - Authenticate the recipient. Consume once.

The automated recipient signed a production challenge using a disposable in memory EVM key. Access returned the synthetic vault with HTTP two hundred. Reusing the exact same signed request returned HTTP four oh three, challenge used. New signed requests for the wrong scope, wrong recipient, and forged creator were also denied. A wrong origin was rejected at challenge issuance. These are gateway responses from the deployed application, not mocked policy results.

01:24 - Revoke a real grant. Check again.

Revocation used a new disposable fixture. It first granted signed access. The trusted issuer then deleted that same entity. The confirmed deletion transaction and Entity Deleted event distinguish revocation from simple absence. A fresh SDK lookup found no entity, and a newly signed production access request returned four oh three, not found. The deployed showcase grant was preserved.

01:52 - Storage retention cannot extend authorization.

Readonly does not mean the storage expiry can never move. The owner extended this fixture from block seven two seven two oh eight to seven two seven four eight five. Its immutable payload and authorization deadline remained unchanged. After the real deadline, the entity was still present, but signed access returned deadline passed. A separate sixty second storage fixture allowed access before expiring, then became absent and denied with not found. Both checks used real elapsed time and live chain height.

02:26 - Permanent, reproducible security evidence.

The repository preserves receipts, timestamps, decoded payloads and redacted production responses. Offline checks validate sixteen production outcomes, four existing creation receipts and five new lifecycle receipts. All seventy five local tests pass. The build succeeds, and the audit reports zero vulnerabilities. MetaMask footage remains a manual check. Arkiv proves the permission record; AccessLease authenticates the wallet and enforces every fetch.
