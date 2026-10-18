param([string]$OutputDirectory = 'artifacts/demo', [int]$StartScene = 1)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$out = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
foreach ($folder in @($out, (Join-Path $out 'frames'), (Join-Path $out 'audio'), (Join-Path $out 'segments'))) {
    [IO.Directory]::CreateDirectory($folder) | Out-Null
}
$baseline = Get-Content 'arkiv/evidence/2026-10-18/baseline.json' -Raw | ConvertFrom-Json
$lifecycle = Get-Content 'arkiv/evidence/2026-10-18/lifecycle.json' -Raw | ConvertFrom-Json
function CheckValue([string]$name) { return ($lifecycle.checks | Where-Object label -EQ $name | Select-Object -First 1).value }
$trusted = $baseline.entities | Where-Object label -EQ 'production-trusted'
$forged = $baseline.entities | Where-Object label -EQ 'production-forged'
$trustedTx = $trusted.events | Where-Object eventName -EQ 'EntityCreated'
$forgedTx = $forged.events | Where-Object eventName -EQ 'EntityCreated'
$revoked = $lifecycle.fixtures.'revocation-fixture'
$deleteTx = $lifecycle.transactions | Where-Object label -EQ 'delete-revocation-fixture'
$before = CheckValue 'deadline-fixture:on-chain-before'
$extended = CheckValue 'deadline-after-storage-extension'
$expired = CheckValue 'expired-deadline-on-chain'
$extensionTx = $lifecycle.transactions | Where-Object label -EQ 'extend-deadline-fixture-storage'
$deadlineText = [DateTimeOffset]::FromUnixTimeMilliseconds($before.payload.deadlineMs).UtcDateTime.ToString('yyyy-MM-dd HH:mm:ss.fff') + ' UTC'
$scenes = @(
    @{ title = 'Temporary permissions. Verifiable evidence.'; duration = 24; rows = @(
        'ACCESSLEASE  /  ARKIV GLOBAL TOUR  /  SECURITY TRACK',
        'https://accesslease-three.vercel.app/',
        'Arkiv Tiramisu  |  Chain ID 7738577',
        'Grant -> wallet challenge -> fresh on-chain policy check',
        'Captured production HTTP + real transaction receipts',
        'Evidence walkthrough; browser and MetaMask UI are not recorded.'
    ); speech = 'AccessLease grants temporary, resource scoped permission backed by public Arkiv records. A contractor signs a single use wallet challenge before the gateway returns a synthetic incident vault. This evidence walkthrough uses real Tiramisu receipts and fresh production responses captured on October eighteenth. It is a narrated record of those observations, with no browser or MetaMask interaction claimed.' },
    @{ title = 'Copied metadata cannot forge the creator.'; duration = 32; rows = @(
        ('TRUSTED CREATOR  ' + $trusted.creator),
        ('ENTITY  ' + $trusted.key),
        ('TX      ' + $trustedTx.transactionHash),
        ('BLOCK   ' + $trusted.creationBlock + '  |  Public decision: allowed'),
        ('ATTACKER CREATOR ' + $forged.creator),
        ('ENTITY  ' + $forged.key),
        ('TX      ' + $forgedTx.transactionHash),
        ('BLOCK   ' + $forged.creationBlock + '  |  Public decision: issuer_mismatch'),
        'Both use vault-demo and the same recipient. Their actual creators differ.'
    ); speech = 'These are the existing production examples. The trusted grant and forged grant use the same recipient and resource. Their on chain creators differ. AccessLease checks the actual creator and owner, rather than accepting an issuer claim inside copied metadata. The trusted sample was allowed. The attacker sample returned issuer mismatch. Each entity key is linked to its separate creation transaction through the Entity Created event, successful receipt, and block timestamp.' },
    @{ title = 'Authenticate the recipient. Consume once.'; duration = 28; rows = @(
        'PRODUCTION POST /api/access  |  EIP-191 wallet signatures',
        '200  allowed           -> SYNTHETIC incident vault report',
        '403  challenge_used    -> exact signed request replayed',
        '403  resource_mismatch -> vault grant requested analytics',
        '403  subject_mismatch  -> a different wallet signed',
        '403  issuer_mismatch   -> forged lease presented',
        '403  audience_mismatch -> challenge requested from another origin',
        'Fresh challenges; shared Redis; no protected data in denials.'
    ); speech = 'The automated recipient signed a production challenge using a disposable in memory EVM key. Access returned the synthetic vault with HTTP two hundred. Reusing the exact same signed request returned HTTP four oh three, challenge used. New signed requests for the wrong scope, wrong recipient, and forged creator were also denied. A wrong origin was rejected at challenge issuance. These are gateway responses from the deployed application, not mocked policy results.' },
    @{ title = 'Revoke a real grant. Check again.'; duration = 28; rows = @(
        'NEW DISPOSABLE FIXTURE  |  Original showcase grant preserved',
        ('ENTITY  ' + $revoked.entityKey),
        ('CREATE  ' + $revoked.txHash),
        ('DELETE  ' + $deleteTx.txHash),
        ('DELETE BLOCK  ' + $deleteTx.receipt.blockNumber),
        'Before deletion: signed access -> 200 / allowed',
        'After confirmation: SDK lookup -> NoEntityFoundError',
        'New signed access -> 403 / not_found',
        'EntityDeleted receipt establishes explicit revocation.'
    ); speech = 'Revocation used a new disposable fixture. It first granted signed access. The trusted issuer then deleted that same entity. The confirmed deletion transaction and Entity Deleted event distinguish revocation from simple absence. A fresh SDK lookup found no entity, and a newly signed production access request returned four oh three, not found. The deployed showcase grant was preserved.' },
    @{ title = 'Storage retention cannot extend authorization.'; duration = 34; rows = @(
        ('ENTITY  ' + $before.key),
        ('EXTEND  ' + $extensionTx.txHash),
        ('STORAGE EXPIRY  ' + $before.expiresAtBlock + ' -> ' + $extended.expiresAtBlock),
        ('FIXED DEADLINE  ' + $deadlineText),
        ('AFTER DEADLINE  Entity still present at head ' + $expired.headBlock),
        'Public verification -> deadline_passed',
        'New signed access -> 403 / deadline_passed',
        'Separate 60-second storage fixture: allowed, then absent on Arkiv',
        'After chain expiry -> 403 / not_found',
        'Real time and live block height. No mocked clocks.'
    ); speech = 'Readonly does not mean the storage expiry can never move. The owner extended this fixture from block seven two seven two oh eight to seven two seven four eight five. Its immutable payload and authorization deadline remained unchanged. After the real deadline, the entity was still present, but signed access returned deadline passed. A separate sixty second storage fixture allowed access before expiring, then became absent and denied with not found. Both checks used real elapsed time and live chain height.' },
    @{ title = 'Permanent, reproducible security evidence.'; duration = 28; rows = @(
        '75 passing automated tests  |  Successful production build',
        '0 npm audit vulnerabilities  |  SDK 0.8.1  |  viem 2.57.7',
        '4 existing creation receipts + 5 new lifecycle receipts',
        '16 captured production outcomes checked offline',
        'docs/SECURITY_EVIDENCE.md  |  arkiv/schema.md  |  arkiv/friction.md',
        'Raw logs, calldata, timestamps and redacted HTTP responses retained.',
        'No secrets or signed requests included. Synthetic MVP only.',
        'Arkiv proves the record. The gateway enforces access.',
        'github.com/EmmyKay0026/AccessLease'
    ); speech = 'The repository preserves receipts, timestamps, decoded payloads and redacted production responses. Offline checks validate sixteen production outcomes, four existing creation receipts and five new lifecycle receipts. All seventy five local tests pass. The build succeeds, and the audit reports zero vulnerabilities. MetaMask footage remains a manual check. Arkiv proves the permission record; AccessLease authenticates the wallet and enforces every fetch.' }
)

$voice = New-Object -ComObject SAPI.SpVoice
$voice.Rate = 2
$fontTitle = New-Object Drawing.Font('Segoe UI', 30, [Drawing.FontStyle]::Bold)
$fontMono = New-Object Drawing.Font('Consolas', 15)
$fontSmall = New-Object Drawing.Font('Segoe UI', 12)
$textBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#EAF0F8'))
$mutedBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#9EACC1'))
$accentBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#68E3BF'))
$cardBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#142034'))
$captions = New-Object 'Collections.Generic.List[string]'
$transcript = New-Object 'Collections.Generic.List[string]'
$captionIndex = 1
$elapsed = 0
function Stamp([double]$seconds) { return [TimeSpan]::FromSeconds($seconds).ToString('hh\:mm\:ss\,fff') }
for ($i = 0; $i -lt $scenes.Count; $i++) {
    $scene = $scenes[$i]
    $number = '{0:D2}' -f ($i + 1)
    $frame = Join-Path $out "frames/$number.png"
    $audio = Join-Path $out "audio/$number.wav"
    $segment = Join-Path $out "segments/$number.mp4"
    if (($i + 1) -ge $StartScene) {
    $bitmap = New-Object Drawing.Bitmap(1280, 720)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#0B1220'))
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.FillRectangle($accentBrush, 60, 48, (1160 * ($i + 1) / $scenes.Count), 5)
    $graphics.DrawString("ACCESSLEASE / $number", $fontSmall, $accentBrush, 60, 70)
    $graphics.DrawString($scene.title, $fontTitle, $textBrush, 60, 108)
    $graphics.FillRectangle($cardBrush, 60, 182, 1160, 440)
    $rowY = 201
    foreach ($row in $scene.rows) {
        $graphics.DrawString([string]$row, $fontMono, $textBrush, 82, $rowY)
        $rowY += 37
    }
    $graphics.DrawString('CAPTURED EVIDENCE | 18 OCT 2026 | NARRATED WALKTHROUGH', $fontSmall, $mutedBrush, 60, 654)
    $graphics.DrawString('Not a live browser recording', $fontSmall, $mutedBrush, 933, 654)
    $bitmap.Save($frame, [Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Open($audio, 3, $false)
    $voice.AudioOutputStream = $stream
    $voice.Speak($scene.speech, 0) | Out-Null
    $stream.Close()
    }
    $spokenDuration = [double](& ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $audio)
    if ($spokenDuration -gt ($scene.duration - 0.2)) { throw "Narration exceeds scene $number duration: $spokenDuration" }
    if (($i + 1) -ge $StartScene) {
    & ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 15 -i $frame -i $audio -c:v libx264 -preset veryfast -tune stillimage -crf 23 -pix_fmt yuv420p -c:a aac -b:a 96k -af apad -t $scene.duration -movflags +faststart $segment
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for scene $number" }
    }
    $words = $scene.speech -split '\s+'
    for ($wordIndex = 0; $wordIndex -lt $words.Count; $wordIndex += 11) {
        $lastWord = [Math]::Min($wordIndex + 10, $words.Count - 1)
        $chunkStart = $elapsed + $spokenDuration * $wordIndex / $words.Count
        $chunkEnd = $elapsed + $spokenDuration * ($lastWord + 1) / $words.Count
        $captions.Add([string]$captionIndex)
        $captions.Add("$(Stamp $chunkStart) --> $(Stamp $chunkEnd)")
        $captions.Add(($words[$wordIndex..$lastWord] -join ' '))
        $captions.Add('')
        $captionIndex++
    }
    $transcript.Add("$([TimeSpan]::FromSeconds($elapsed).ToString('mm\:ss')) - $($scene.title)`n`n$($scene.speech)`n")
    $elapsed += $scene.duration
    "Rendered scene $number ($spokenDuration seconds narration)"
}
$concat = ($scenes | ForEach-Object -Begin { $index = 0 } -Process { $index++; "file 'segments/$('{0:D2}' -f $index).mp4'" }) -join "`n"
[IO.File]::WriteAllText((Join-Path $out 'concat.txt'), $concat)
& ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i (Join-Path $out 'concat.txt') -c copy -movflags +faststart -metadata title='AccessLease - Verified Security Evidence' -metadata comment='Narrated walkthrough of captured production HTTP and Arkiv receipts; not a live browser or MetaMask recording.' (Join-Path $out 'accesslease-evidence-demo.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Final video concatenation failed' }
[IO.File]::WriteAllText((Join-Path $out 'accesslease-evidence-demo.srt'), ($captions -join "`n"))
[IO.File]::WriteAllText((Join-Path $out 'transcript.md'), "# AccessLease evidence video transcript`n`n" + ($transcript -join "`n"))
$fontTitle.Dispose(); $fontMono.Dispose(); $fontSmall.Dispose()
$textBrush.Dispose(); $mutedBrush.Dispose(); $accentBrush.Dispose(); $cardBrush.Dispose()
"Created $elapsed-second narrated evidence walkthrough."
