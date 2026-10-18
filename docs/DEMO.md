# AccessLease - demonstration package

The prepared video is [artifacts/demo/accesslease-evidence-demo.mp4](../artifacts/demo/accesslease-evidence-demo.mp4), **2 minutes 54 seconds**, with English speech and [SRT captions](../artifacts/demo/accesslease-evidence-demo.srt). The [transcript](../artifacts/demo/transcript.md) matches the narration. It is a walkthrough of real captured production results and Arkiv receipts, explicitly labeled **not a live browser recording**. MetaMask UI footage was unavailable because the browser capture helper timed out.

| Video time | Demonstration | Supporting evidence |
| --- | --- | --- |
| 0:00-0:24 | Temporary, scoped permissions and authentication | Live app URL, Tiramisu chain ID, synthetic-resource scope |
| 0:24-0:56 | Trusted and attacker grants: same metadata, different actual creators | Existing entity keys, distinct creation hashes, blocks and public verification |
| 0:56-1:24 | Signed access, replay, wrong scope, recipient, issuer and origin | Production 200/allowed and 403 denial responses |
| 1:24-1:52 | Explicit revocation of a disposable fixture | Creation/deletion transactions, EntityDeleted and new 403/not_found |
| 1:52-2:26 | Fixed deadline after storage extension, then retention expiry | Before/after expiry blocks, unchanged payload, deadline_passed and not_found |
| 2:26-2:54 | Permanent evidence, tests, schema and friction report | 75 tests, successful build, zero audit findings, public repository |

The transaction and response details are in [SECURITY_EVIDENCE.md](SECURITY_EVIDENCE.md). The recording generator reads captured JSON files and never accesses wallet keys. It requires existing Windows SAPI speech, System.Drawing and ffmpeg:

```powershell
powershell -NoProfile -File scripts/render-evidence-demo.ps1
```

## Optional live browser take

Keep a live take under three minutes. Show previously confirmed receipts without implying they were submitted during filming.

1. **0:00-0:20:** Open the dashboard. Explain that a copied grant must not impersonate a trusted issuer or authorize a different wallet/resource.
2. **0:20-0:45:** Show the trusted creation receipt and entity key. Verify the live grant. Point out actual creator, recipient, scope and fixed deadline.
3. **0:45-1:15:** Select MetaMask and the actual recipient, request access, inspect the origin/resource/lease challenge and sign. Show the synthetic vault. Replay the exact successful body privately in DevTools; show only the 403/challenge_used response, never expose a signature in the video.
4. **1:15-1:40:** Verify the forged grant and the wrong scope. Show issuer_mismatch and resource_mismatch.
5. **1:40-2:20:** Show the captured deletion receipt and fresh denial. Show the expiry/extension evidence: storage was extended but the fixed deadline still denied authorization.
6. **2:20-3:00:** Open the repository schema, friction report and evidence. Close with: "Arkiv supplies public permission evidence; AccessLease checks the wallet and enforces every fetch."

The showcased recipient is `0x642eEB59592F1aB86c72DAE319a1B60A1a521A1D`. Its key is never needed by the evidence scripts. Use the account already held in MetaMask. Do not import keys, reveal seed phrases, film environment files or put real data on-chain.

The captured production trusted sample ends at **08:22:36.061 Nigerian time on 18 October 2026**. Afterward it must deny. Refresh disposable examples near a new recording using the existing issue/forge CLI and preserve both returned hashes and keys. A storage extension does not renew authorization. Do not delete the production showcase to recreate the already verified revocation experiment.

## Publication handoff

Upload the prepared MP4, or a completed live take, to an owner-controlled public video destination. Verify playback without signing in. Put the public URL on Devfolio alongside the links from [SUBMISSION.md](SUBMISSION.md). The local MP4 is not a hosted video URL. No video upload or final Devfolio submission is claimed here.
