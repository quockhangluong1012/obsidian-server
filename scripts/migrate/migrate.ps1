<#
.SYNOPSIS
    One-shot migration: Obsidian vault files -> SQL Server (ObsidianDb) + Vercel Blob (private store).
.DESCRIPTION
    - Inlines every .json into the NOTE that lives in the same folder & has the same base name.
    - Rewrites local image links (![](...) / <img src>) to the private blob URL (served via server proxy).
    - Uploads .svg/.png attachments to Vercel Blob and records them in Attachments.
    - Inserts Folder tree (recursive), Notes, Attachments into ObsidianDb.
    - Idempotent: skips rows whose Id already exists.
.PARAMETER ConfigPath
    Path to config.json (defaults to ./config.json next to this script).
.PARAMETER DryRun
    Build the inventory and report, but do not touch DB or blob storage.
.PARAMETER SkipBlob
    Run without uploading attachments; links to images stay unresolved (until a later full run). Attachments rows are not created.
.PARAMETER OnlyNotes
    Insert folders + notes only; do not upload attachments (same as -SkipBlob but also skips re-scan of attachments).
.EXAMPLE
    .\migrate.ps1 -DryRun
.EXAMPLE
    .\migrate.ps1
.EXAMPLE
    .\migrate.ps1 -SkipBlob
#>
[CmdletBinding()]
param(
    [string]$ConfigPath,
    [switch]$DryRun,
    [switch]$SkipBlob,
    [switch]$OnlyNotes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$libDir = Join-Path $scriptDir 'lib'

. (Join-Path $libDir 'Common.ps1')
. (Join-Path $libDir 'Inventory.ps1')
. (Join-Path $libDir 'Sql.ps1')
. (Join-Path $libDir 'Blob.ps1')
. (Join-Path $libDir 'Rewriter.ps1')
. (Join-Path $libDir 'JsonInline.ps1')

if (-not $ConfigPath) { $ConfigPath = Join-Path $scriptDir 'config.json' }
$cfg = Read-MigrateConfig -ConfigPath $ConfigPath

$logFile = Join-Path $cfg.logDir ("migrate-{0}.log" -f [DateTime]::Now.ToString('yyyyMMdd-HHmmss'))
$log = New-MigrateLogger -LogFile $logFile

# ---- basic param validation ----
if ($SkipBlob) { $OnlyNotes = $true }
if ($OnlyNotes -and -not $DryRun) { $SkipBlob = $true }
if ($DryRun) { $SkipBlob = $true }

try {
    & $log.Info "Target DB: ObsidianDb (folders/notes/attachments)"
    & $log.Info "Blob endpoint: $($cfg.blob.baseUrl)"

    # ---- 1. Inventory ----
    & $log.Step "Scanning vault: $($cfg.vaultPath)"
    $inv = Build-VaultInventory `
        -VaultRoot $cfg.vaultPath `
        -ExcludeNames $cfg.excludeNames `
        -NoteExtensions $cfg.noteExtensions `
        -AttachmentExtensions $cfg.attachmentExtensions `
        -JsonExtensions $cfg.jsonExtensions `
        -JsonInlineMaxBytes $cfg.jsonInlineMaxBytes
    $rep = Get-InventoryReport -Inventory $inv
    & $log.Info ("folders={0} notes={1} attachments={2} json={3} skipped={4}" -f $rep.Folders, $rep.Notes, $rep.Attachments, $rep.Json, $rep.Skipped)

    if ($DryRun) {
        & $log.Info 'DRY RUN: no changes made.'
        & $log.Close
        exit 0
    }

    # ---- 2. DB connection ----
    & $log.Step 'Connecting to SQL Server...'
    $conn = New-MigrateSql -ConnectionString $cfg.connectionString
    try {
        # Existing ids
        $existingFolders = Get-ExistingIdsFromTable -Connection $conn -Table 'Folders'
        $existingNotes   = Get-ExistingIdsFromTable -Connection $conn -Table 'Notes'
        $existingAtts    = Get-ExistingIdsFromTable -Connection $conn -Table 'Attachments'
        & $log.Info ("existing in DB: folders={0} notes={1} attachments={2}" -f $existingFolders.Count, $existingNotes.Count, $existingAtts.Count)

        # ---- 3. Insert folders (parent-first by depth) ----
        & $log.Step 'Inserting folders...'
        $insDir = 0; $skipDir = 0
        foreach ($f in $inv.Folders | Sort-Object Depth) {
            if ($existingFolders.Contains($f.Id)) { $skipDir++; continue }
            $created = if ($f.CreatedUtc) { $f.CreatedUtc } else { [DateTime]::UtcNow }
            [void](Invoke-MigrateNonQuery -Connection $conn -CommandText @'
INSERT INTO [Folders] ([Id], [Name], [ParentId], [CreatedAt])
VALUES (@Id, @Name, @ParentId, @CreatedAt)
'@ -Parameters @{
                Id = $f.Id; Name = $f.Name; ParentId = $f.ParentId; CreatedAt = $created
            })
            $existingFolders.Add($f.Id) | Out-Null
            $insDir++
        }
        & $log.Info "folders inserted=$insDir skipped=$skipDir"

        # ---- 4. Upload attachments ----
        $attRows = 0; $attSkip = 0; $attFail = 0
        if (-not $SkipBlob) {
            & $log.Step "Uploading $($inv.Atts.Count) attachments to Vercel Blob..."
            $token = Get-BlobToken -EnvName $cfg.blob.tokenEnvName

            $i = 0
            foreach ($a in $inv.Atts) {
                $i++
                if ($existingAtts.Contains($a.Id)) { $attSkip++; continue }

                $bytes = [System.IO.File]::ReadAllBytes($a.Full)
                $mime = Get-MimeFromPath -RelPath $a.RelPath
                $contentType = $mime
                if ($a.Ext -eq '.json') { $contentType = 'application/json' }

                $relKey = if ($cfg.blob.pathPrefix) { $cfg.blob.pathPrefix + $a.RelPath } else { $a.RelPath }
                $blobUrl = Get-BlobPublicUrl -PublicUrlTemplate $cfg.blob.publicUrlTemplate -BaseUrl $cfg.blob.baseUrl -RelativePath $relKey
                $result = Send-BlobPutUpload `
                    -UploadEndpoint $cfg.blob.uploadEndpoint `
                    -RelativePath $relKey `
                    -ContentType $contentType `
                    -Token $token `
                    -Bytes $bytes `
                    -RetryCount $cfg.blob.retryCount `
                    -RetryBackoffSeconds $cfg.blob.retryBackoffSeconds `
                    -AddRandomSuffix:$cfg.blob.addRandomSuffix

                if ($result.Success) {
                    $sql = @'
INSERT INTO [Attachments] ([Id], [FileName], [ContentType], [StoragePath], [Url], [Size], [FolderId], [NoteId], [CreatedAt])
VALUES (@Id, @FileName, @ContentType, @StoragePath, @Url, @Size, @FolderId, @NoteId, @CreatedAt)
'@
                    [void](Invoke-MigrateNonQuery -Connection $conn -CommandText $sql -Parameters @{
                        Id = $a.Id; FileName = $a.FileName; ContentType = $contentType
                        StoragePath = $result.Pathname; Url = $result.Url; Size = $a.Size
                        FolderId = $a.FolderId; NoteId = $null; CreatedAt = $a.CreatedUtc
                    })
                    $existingAtts.Add($a.Id) | Out-Null
                    $attRows++
                    if ($i % 50 -eq 0) { & $log.Info ("  uploaded {0}/{1}" -f $i, $inv.Atts.Count) }
                }
                else {
                    $attFail++
                    & $log.Warn ("  FAIL upload '{0}': {1}" -f $a.RelPath, $result.Error)
                }
            }
            & $log.Info "attachments: uploaded=$attRows skipped=$attSkip failed=$attFail"
        }

        # ---- 5. Insert notes (with image-link rewrite + json inline) ----
        & $log.Step "Inserting $($inv.Notes.Count) notes..."
        $insNote = 0; $skipNote = 0; $failNote = 0

        # directory bundle: for inlining JSON into matching notes
        $jsonLookup = @{}
        foreach ($j in $inv.Json) {
            if (-not $jsonLookup.ContainsKey($j.DirRel)) { $jsonLookup[$j.DirRel] = New-Object System.Collections.Generic.List[object] }
            $jsonLookup[$j.DirRel].Add($j)
        }

        # Attachment rel-path -> blob URL lookup, for resolving image refs
        $attUrlByRel = @{}
        $existingAttUrlById = @{}
        foreach ($row in (Invoke-MigrateReader -Connection $conn -CommandText 'SELECT Id, Url FROM [Attachments]')) {
            $existingAttUrlById[$row.Id] = $row.Url
            $existingAtts.Add($row.Id) | Out-Null
        }
        $attUrlsByFileName = @{}
        foreach ($a in $inv.Atts) {
            $nameKey = $a.FileName.ToLowerInvariant()
            if (-not $attUrlsByFileName.ContainsKey($nameKey)) {
                $attUrlsByFileName[$nameKey] = New-Object System.Collections.Generic.List[string]
            }
            [void]$attUrlsByFileName[$nameKey].Add($a.RelPath)
        }

        foreach ($a in $inv.Atts) {
            if ($existingAttUrlById.ContainsKey($a.Id)) {
                $attUrlByRel[$a.RelPath.ToLowerInvariant()] = $existingAttUrlById[$a.Id]
            }
            else {
                # assume the blob exists (will be uploaded above) and synthesize the private URL
                $relKey = if ($cfg.blob.pathPrefix) { $cfg.blob.pathPrefix + $a.RelPath } else { $a.RelPath }
                $attUrlByRel[$a.RelPath.ToLowerInvariant()] = Get-BlobPublicUrl `
                    -PublicUrlTemplate $cfg.blob.publicUrlTemplate `
                    -BaseUrl $cfg.blob.baseUrl `
                    -RelativePath $relKey
            }
        }

        $n = 0
        foreach ($md in $inv.Notes) {
            $n++
            if ($existingNotes.Contains($md.Id)) { $skipNote++; continue }

            $content = ''
            try {
                $content = [System.IO.File]::ReadAllText($md.Full, [System.Text.Encoding]::UTF8)
            }
            catch {
                $failNote++
                & $log.Warn ("  FAIL read note '{0}': {1}" -f $md.RelPath, $_.Exception.Message)
                continue
            }

            # ---- inline matching JSON ----
            if ($jsonLookup.ContainsKey($md.DirRel)) {
                $sameName = $jsonLookup[$md.DirRel] | Where-Object { $_.NameNoExt -eq $md.NameNoExt }
                foreach ($jf in $sameName) {
                    try {
                        $jsonText = [System.IO.File]::ReadAllText($jf.Full, [System.Text.Encoding]::UTF8)
                        $content = Append-InlineJson -MarkdownText $content -FileRelPath $jf.RelPath -JsonContent $jsonText
                    }
                    catch { & $log.Warn ("  FAIL inline json '{0}': {1}" -f $jf.RelPath, $_.Exception.Message) }
                }
            }

            # ---- rewrite local image links ----
            $rewritten = 0
            foreach ($match in (Get-ImageLinkMatches -Content $content | Sort-Object Start -Descending)) {
                $t = $match.Target
                if ($t -match '(?i)^https?://' -or $t -match '^data:') { continue }
                if ($match.Type -eq 'md-image' -and $t -notmatch '(?i)\.(svg|png|jpe?g|gif|webp)$') { continue }

                $candidateRel = Resolve-LocalAssetRel -NoteDirRel $md.DirRel -RefPath $t
                $candidateRelLower = if ($candidateRel) { $candidateRel.ToLowerInvariant() } else { $null }
                if ($candidateRelLower -and $attUrlByRel.ContainsKey($candidateRelLower)) {
                    $newUrl = $attUrlByRel[$candidateRelLower]
                    $content = $content.Substring(0, $match.Start) + $newUrl + $content.Substring($match.Start + $match.Length)
                    $rewritten++
                }
                elseif ($match.Type -eq 'obsidian-embed') {
                    $fileName = [System.IO.Path]::GetFileName($t).ToLowerInvariant()
                    $paths = if ($attUrlsByFileName.ContainsKey($fileName)) { @($attUrlsByFileName[$fileName]) } else { @() }
                    if (@($paths).Count -eq 1) {
                        $selectedPath = if ($paths -is [string]) { $paths } else { $paths[0] }
                        $newUrl = $attUrlByRel[$selectedPath.ToLowerInvariant()]
                        $content = $content.Substring(0, $match.Start) + $newUrl + $content.Substring($match.Start + $match.Length)
                        $rewritten++
                    }
                    elseif (@($paths).Count -gt 1) {
                        & $log.Warn ("  note '{0}': ambiguous Obsidian image embed: {1}" -f $md.RelPath, $t)
                    }
                    else {
                        & $log.Warn ("  note '{0}': image ref not found in vault: {1}" -f $md.RelPath, $t)
                    }
                }
                else {
                    & $log.Warn ("  note '{0}': image ref not found in vault: {1}" -f $md.RelPath, $t)
                }
            }
            if ($rewritten -gt 0) {
                & $log.Info ("  note '{0}' rewrote {1} image link(s)" -f $md.RelPath, $rewritten)
            }

            # ---- insert note ----
            $sql = @'
INSERT INTO [Notes] ([Id], [Title], [FolderId], [Content], [CreatedAt], [UpdatedAt])
VALUES (@Id, @Title, @FolderId, @Content, @CreatedAt, @UpdatedAt)
'@
            try {
                [void](Invoke-MigrateNonQuery -Connection $conn -CommandText $sql -Parameters @{
                    Id = $md.Id; Title = $md.NameNoExt; FolderId = $md.FolderId; Content = $content
                    CreatedAt = $md.CreatedUtc; UpdatedAt = $md.UpdatedUtc
                })
                $existingNotes.Add($md.Id) | Out-Null
                $insNote++
            }
            catch {
                $failNote++
                & $log.Warn ("  FAIL insert note '{0}': {1}" -f $md.RelPath, $_.Exception.Message)
            }
            if ($n % 100 -eq 0) { & $log.Info ("  notes processed {0}/{1}" -f $n, $inv.Notes.Count) }
        }
        & $log.Info "notes: inserted=$insNote skipped=$skipNote failed=$failNote"

        # ---- 6. Summary ----
        & $log.Ok "Done. folders+$insDir notes+$insNote attachments+$attRows"
    }
    finally {
        $conn.Dispose()
    }
}
catch {
    & $log.Error ("ERROR: {0}" -f $_.Exception.Message)
    & $log.Error ($_.ScriptStackTrace)
    & $log.Close
    exit 1
}

& $log.Close