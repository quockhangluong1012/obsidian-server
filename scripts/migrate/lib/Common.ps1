using namespace System.Text
using namespace System.Security.Cryptography

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ScriptLibDir {
    return $PSScriptRoot
}

function Read-MigrateConfig {
    param(
        [string]$ConfigPath
    )
    $local = Join-Path (Split-Path -Parent $ConfigPath) 'config.local.json'
    $path = $ConfigPath
    if (Test-Path -LiteralPath $local) { $path = $local }
    $cfg = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    return $cfg
}

function Resolve-VaultRoot {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $resolved = [System.IO.Path]::GetFullPath($full.TrimEnd('\') + '\')
    return $resolved
}

function Get-RelativePath {
    param([string]$Root, [System.IO.FileSystemInfo]$Item)
    $full = $Item.FullName
    if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path '$full' is outside vault root '$Root'"
    }
    $rel = $full.Substring($Root.Length)
    return $rel.Replace('\', '/')
}

function Get-VaultId {
    param([string]$RelativePath)
    $sha = [SHA256]::Create()
    $bytes = [Encoding]::UTF8.GetBytes($RelativePath.ToLowerInvariant())
    $hash = $sha.ComputeHash($bytes)
    $sb = [StringBuilder]::new(64)
    foreach ($b in $hash) { [void]$sb.Append($b.ToString('x2')) }
    return $sb.ToString()
}

function Get-IdForPath {
    param([string]$Root, [System.IO.FileSystemInfo]$Item)
    $rel = [Uri]::UnescapeDataString((Get-RelativePath -Root $Root -Item $Item))
    return (Get-VaultId -RelativePath $rel)
}

$script:__logStream = $null

function Write-Log {
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    $line = "[" + [DateTime]::Now.ToString('HH:mm:ss') + "] $Message"
    try { if ($script:__logStream) { $script:__logStream.WriteLine($line) } } catch { }
    try {
        $host.UI.RawUI.ForegroundColor = $Color
        Write-Output $line
    }
    catch { Write-Output $line }
    finally {
        try { $host.UI.RawUI.ForegroundColor = [ConsoleColor]::Gray } catch { }
    }
}

function New-MigrateLogger {
    param(
        [string]$LogFile
    )
    $logDir = Split-Path -Parent $LogFile
    if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    # Open the log file once and reuse the stream
    $script:__logStream = [System.IO.StreamWriter]::new($LogFile, $true, [System.Text.Encoding]::UTF8)
    $script:__logStream.AutoFlush = $true
    $script:__logStream.WriteLine("==== Migration log started $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')) ====")

    return @{
        Info    = { param($m) Write-Log -Message $m -Color Gray }
        Step    = { param($m) Write-Log -Message $m -Color Cyan }
        Warn    = { param($m) Write-Log -Message $m -Color Yellow }
        Ok      = { param($m) Write-Log -Message $m -Color Green }
        Error   = { param($m) Write-Log -Message $m -Color Red }
        Close   = {
            param()
            if ($script:__logStream) {
                $script:__logStream.WriteLine("==== Migration log ended " + [DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss') + " ====")
                $script:__logStream.Dispose()
                $script:__logStream = $null
            }
        }
    }
}