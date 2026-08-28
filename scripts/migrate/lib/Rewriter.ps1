Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ImageLinkMatches {
    param([string]$Content)
    $found = New-Object System.Collections.Generic.List[object]
    if ($Content.Length -lt 3) { return $found }

    $i = 0
    while ($i -lt $Content.Length) {
        $imgIdx = $Content.IndexOf('![', [System.Math]::Min($i, $Content.Length - 1))
        $tagIdx = $Content.IndexOf('<img', [System.Math]::Min($i, $Content.Length - 1))
        if ($imgIdx -lt 0 -and $tagIdx -lt 0) { $i = $Content.Length; break }
        if ($imgIdx -lt 0) { $imgIdx = [int]::MaxValue }
        if ($tagIdx -lt 0) { $tagIdx = [int]::MaxValue }
        $pick = [System.Math]::Min($imgIdx, $tagIdx)
        $i = $pick + 1

        if ($pick -eq $imgIdx -and $imgIdx -lt $Content.Length -and $Content.Substring($imgIdx).StartsWith('![[')) {
            # Obsidian embed: ![[path/to/image.svg|optional display settings]]
            $close = $Content.IndexOf(']]', $imgIdx + 3)
            if ($close -lt 0) { $i = $imgIdx + 3; continue }
            $inner = $Content.Substring($imgIdx + 3, $close - $imgIdx - 3)
            $target = $inner.Split('|', 2)[0].Trim()
            if ($target.Length -gt 0) {
                $found.Add([pscustomobject]@{
                    Type   = 'obsidian-embed'
                    Start  = $imgIdx + 3
                    Length = $target.Length
                    Target = $target
                })
            }
            $i = $close + 2
        }
        elseif ($pick -eq $imgIdx -and $imgIdx -lt $Content.Length) {
            # ![...](...)
            $openParen = $Content.IndexOf('(', $imgIdx + 2)
            if ($openParen -lt 0) { $i = [System.Math]::Max($i, $openParen + 1); continue }
            # balance parens (alt text may contain ())
            $depth = 1
            $j = $openParen + 1
            $end = -1
            while ($j -lt $Content.Length -and $depth -gt 0) {
                if ($Content[$j] -eq '(') { $depth++ }
                elseif ($Content[$j] -eq ')') { $depth-- }
                if ($depth -eq 0) { $end = $j; break }
                $j++
            }
            if ($end -lt 0) { $i = $openParen + 1; continue }
            $target = $Content.Substring($openParen + 1, $end - $openParen - 1).Trim()
            if ($target.Length -eq 0 -or $target -match '^\s*$') { continue }
            $found.Add([pscustomobject]@{
                Type   = 'md-image'
                Start  = $openParen + 1
                Length = $target.Length
                Target = $target
            })
            $i = $end + 1
        }
        elseif ($pick -eq $tagIdx -and $tagIdx -lt $Content.Length) {
            # <img ... src="..." ...>
            $tagEnd = $Content.IndexOf('>', $tagIdx)
            if ($tagEnd -lt 0) { $i = $tagIdx + 4; continue }
            $tag = $Content.Substring($tagIdx, $tagEnd - $tagIdx)
            $m = [regex]::Match($tag, 'src\s*=\s*("([^"]*)"|\''([^\'']*)\''|([^\s>]+))', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($m.Success) {
                $srcStart = $tagIdx + $m.Groups[1].Index
                $srcLen = $m.Groups[1].Value.Length
                $srcVal = $m.Groups[1].Value.Trim('"', "'")
                if ($srcVal.Length -gt 0) {
                    $found.Add([pscustomobject]@{
                        Type   = 'html-img'
                        Start  = $srcStart
                        Length = $srcLen
                        Target = $srcVal
                    })
                }
            }
            $i = $tagEnd + 1
        }
    }
    return $found
}

function Test-BitmapLocalPath {
    param([string]$Path)
    $p = $Path.TrimStart('./')
    return $p -match '(?i)\.(svg|png|jpe?g|gif|webp)$' -and $p -notmatch '(?i)^https?://' -and $p -notmatch '^data:'
}

function Resolve-LocalAssetRel {
    param(
        [string]$NoteDirRel,
        [string]$RefPath
    )
    $ref = $RefPath.TrimStart('./')
    # absolute-from-root reference (markdown sometimes starts with /)
    if ($ref.StartsWith('/')) {
        $ref = $ref.TrimStart('/')
        return (Get-NormalizedRelPath -Path $ref)
    }
    # combine note's folder with relative reference
    $combined = if ($NoteDirRel) { $NoteDirRel + '/' + $ref } else { $ref }
    return (Get-NormalizedRelPath -Path $combined)
}

function Get-NormalizedRelPath {
    param([string]$Path)
    $parts = @()
    foreach ($seg in $Path.Split('/')) {
        if ($seg -eq '.' -or $seg -eq '') { continue }
        elseif ($seg -eq '..') {
            if ($parts.Count -gt 0) { $parts = $parts[0..($parts.Count - 2)] }
            else { return $null }  # escaped above vault root
        }
        else { $parts += $seg }
    }
    if ($parts.Count -eq 0) { return $null }
    return ($parts -join '/')
}

function Get-MimeFromPath {
    param([string]$RelPath)
    $ext = [System.IO.Path]::GetExtension($RelPath).ToLowerInvariant()
    $map = @{
        '.svg' = 'image/svg+xml'
        '.png' = 'image/png'
        '.jpg' = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.gif' = 'image/gif'
        '.webp' = 'image/webp'
        '.json' = 'application/json'
        '.pdf' = 'application/pdf'
    }
    if ($map.ContainsKey($ext)) { return $map[$ext] }
    return 'application/octet-stream'
}