# AccessLease QA — 18 October 2026

The latest authentication changes, public `/docs` route and Lucide migration are present in source baseline `c113f582cfc38e2bab2d4344df1a13ca5b2b7e0d` and were retained. Evidence work adds scripts, reports and artifacts; it does not change the deployed application or authentication implementation.

| Check | Fresh result | Evidence |
| --- | --- | --- |
| Automated suite | 75 passed; 0 failed, skipped or cancelled | [tests.txt](../arkiv/evidence/2026-10-18/tests.txt) |
| TypeScript | `npm run typecheck` exit 0 after evidence-script fixes | Also checked by final build |
| Production build | Exit 0; `/docs` statically generated | [build.txt](../arkiv/evidence/2026-10-18/build.txt) |
| npm audit | 0 vulnerabilities across all severity levels | [audit.json](../arkiv/evidence/2026-10-18/audit.json) |
| Public application and docs | HTTP 200, expected page titles and Lucide markup | [baseline.json](../arkiv/evidence/2026-10-18/baseline.json) |
| Production signed authentication and policy | 16 captured outcomes passed offline checks | [validation.json](../arkiv/evidence/2026-10-18/validation.json) |
| Existing on-chain creation evidence | 4 distinct successful creation receipts | baseline.json and decoded-creations.json |
| New lifecycle transactions | 3 creates, 1 deletion, 1 extension; all successful | [lifecycle.json](../arkiv/evidence/2026-10-18/lifecycle.json) |
| Fixed deadline after storage extension | Payload unchanged; live entity still denied after deadline | lifecycle.json |
| Live MetaMask/browser capture | Unavailable; helper timed out twice | No current UI or wallet screenshots claimed |
| Demonstration artifact | 174.046 seconds; H.264/AAC, 1280×720; frames visually inspected | [MP4](../artifacts/demo/accesslease-evidence-demo.mp4), captions and transcript |

Fresh production access used viem EIP-191 signatures and in-memory disposable recipients, with production challenges and replay consumption. It verifies the deployed HTTP flow; it does not reverify EIP-6963 browser selection, MetaMask connection prompts, account switching, mobile rendering, hydration, keyboard navigation or clipboard behavior. The owner-reported earlier MetaMask success is historical information.

No application security source, administrative CLI, dependency version or deployment configuration was changed. No forced production outage, readonly-patch transaction or lifetime extension by an unauthorized wallet is claimed. The successful extension was by the owner with permissionlessExtension disabled.

During collection, outbound requests and npm's user-directory lookup required approved sandbox execution. Unbounded genesis-to-head logs hit the public RPC's parameter/range restriction; the collector now uses key-filtered windows of at most 100,000 blocks. Completed revocation evidence was preserved and only the remaining expiration phase resumed, with a new ephemeral recipient recorded separately. These were collection limitations, not observed application authorization failures.

The evidence checker asserts actual statuses/reasons, no `data` on denials, transaction-to-key linkage, receipt success, unchanged payload/deadline, and continued entity presence below storage expiry when deadline denial occurred. It reads recorded observations; it does not replace independent RPC verification or make the HTTP captures cryptographically self-authenticating.
