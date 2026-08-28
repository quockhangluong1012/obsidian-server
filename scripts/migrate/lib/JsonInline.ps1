Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-JsonInlinePlan {
    param(
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$JsonFiles,
        [long]$MaxBytes
    )
    $plan = New-Object System.Collections.Generic.List[object]
    foreach ($jf in $JsonFiles) {
        $exceed = $jf.Size -gt $MaxBytes
        $plan.Add([pscustomobject]@{
            File       = $jf
            Exceeds    = $exceed
            UploadBlob = $exceed
        })
    }
    return $plan
}

function Format-JsonBlock {
    param(
        [string]$FileRelPath,
        [string]$JsonContent
    )
    $lines = @()
    $lines += "````json"
    $lines += $JsonContent.TrimEnd()
    $lines += "````"
    return ($lines -join "`n")
}

function Append-InlineJson {
    param(
        [string]$MarkdownText,
        [string]$FileRelPath,
        [string]$JsonContent
    )
    $block = Format-JsonBlock -FileRelPath $FileRelPath -JsonContent $JsonContent
    $sep = if ([string]::IsNullOrWhiteSpace($MarkdownText) -or $MarkdownText.EndsWith("`n")) { "`n" } else { "`n`n" }
    return $MarkdownText + $sep + "> JSON embedded from: $FileRelPath" + "`n`n" + $block + "`n"
}