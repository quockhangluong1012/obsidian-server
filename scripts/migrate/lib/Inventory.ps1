Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Build-VaultInventory {
    param(
        [string]$VaultRoot,
        [string[]]$ExcludeNames,
        [string[]]$NoteExtensions,
        [string[]]$AttachmentExtensions,
        [string[]]$JsonExtensions,
        [long]$JsonInlineMaxBytes
    )
    $root = Resolve-VaultRoot -Path $VaultRoot
    if (-not (Test-Path -LiteralPath $root)) { throw "Vault path not found: $root" }

    $items = Get-ChildItem -LiteralPath $root -Recurse -Force | Where-Object {
        $rel = Get-RelativePath -Root $root -Item $_
        $parts = $rel.Split('/')
        # Exclude hidden/system dirs by name at any depth; also skip root-level .gitignore file
        $skip = $false
        foreach ($p in $parts) {
            if ($ExcludeNames -contains $p) { $skip = $true; break }
        }
        if ($skip) { return $false }
        # directories themselves must not be excluded; only files are collected into buckets
        if ($_.PSIsContainer) { return $true }
        # root-level ignore files (.gitignore, .tmp, etc.) filtered above because parts[0] excluded
        return $true
    }

    $dirs     = @($items | Where-Object { $_.PSIsContainer })
    $files    = @($items | Where-Object { -not $_.PSIsContainer })

    $folders   = New-Object System.Collections.Generic.List[object]
    $noteFiles = New-Object System.Collections.Generic.List[object]
    $attFiles  = New-Object System.Collections.Generic.List[object]
    $jsonFiles = New-Object System.Collections.Generic.List[object]
    $skipped   = New-Object System.Collections.Generic.List[object]

    $dirMap = @{}
    foreach ($d in $dirs) {
        $rel = Get-RelativePath -Root $root -Item $d
        $id  = Get-VaultId -RelativePath $rel
        $pSegs = @($rel.Split('/'))
        if ($pSegs.Count -gt 1) {
            $parentRel = ($pSegs[0..($pSegs.Count - 2)] -join '/')
        } else {
            $parentRel = ''
        }
        $parentId  = if ($parentRel) { Get-VaultId -RelativePath $parentRel } else { $null }
        $dobj = [pscustomobject]@{
            Id         = $id
            Name       = $d.Name
            ParentId   = $parentId
            RelPath    = $rel
            Depth      = $pSegs.Count
            CreatedUtc = $d.CreationTimeUtc
            Full       = $d.FullName
        }
        $folders.Add($dobj)
        $dirMap[$rel] = $dobj
    }

    foreach ($f in $files) {
        $rel = Get-RelativePath -Root $root -Item $f
        $ext = [System.IO.Path]::GetExtension($rel).ToLowerInvariant()
        $id = Get-VaultId -RelativePath $rel
        $dirRel = [System.IO.Path]::GetDirectoryName($rel).Replace('\', '/')
        if ($dirRel) {
            $dirRel = $dirRel.TrimEnd('/')
            $folderId = Get-VaultId -RelativePath $dirRel
        } else {
            $dirRel = ''
            $folderId = $null
        }
        $meta = [pscustomobject]@{
            Id         = $id
            FileName   = $f.Name
            NameNoExt  = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            Ext        = $ext
            RelPath    = $rel
            DirRel     = $dirRel
            FolderId   = $folderId
            Size       = $f.Length
            CreatedUtc = $f.CreationTimeUtc
            UpdatedUtc = $f.LastWriteTimeUtc
            Full       = $f.FullName
        }
        if ($NoteExtensions -contains $ext) { $noteFiles.Add($meta) }
        elseif ($AttachmentExtensions -contains $ext) { $attFiles.Add($meta) }
        elseif ($JsonExtensions -contains $ext) { $jsonFiles.Add($meta) }
        else { $skipped.Add($meta) }
    }

    return [pscustomobject]@{
        VaultRoot = $root
        Folders   = [System.Collections.Generic.List[object]]$folders
        Notes     = [System.Collections.Generic.List[object]]$noteFiles
        Atts      = [System.Collections.Generic.List[object]]$attFiles
        Json      = [System.Collections.Generic.List[object]]$jsonFiles
        Skipped   = [System.Collections.Generic.List[object]]$skipped
        DirMap    = $dirMap
    }
}

function Get-InventoryReport {
    param([object]$Inventory)
    return [pscustomobject]@{
        Folders     = $Inventory.Folders.Count
        Notes       = $Inventory.Notes.Count
        Attachments = $Inventory.Atts.Count
        Json        = $Inventory.Json.Count
        Skipped     = $Inventory.Skipped.Count
        TotalDepth  = if ($Inventory.Folders.Count) { ($Inventory.Folders | Measure-Object Depth -Maximum).Maximum } else { 0 }
    }
}