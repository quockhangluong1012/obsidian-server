Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-BlobToken {
    param(
        [string]$EnvName
    )
    $tok = [System.Environment]::GetEnvironmentVariable($EnvName)
    if ([string]::IsNullOrWhiteSpace($tok)) { throw "Environment variable '$EnvName' is not set (BLOB_READ_WRITE_TOKEN)." }
    return $tok
}

function ConvertTo-UrlPath {
    param([string]$Path)
    # Normalize backslashes and percent-encode each segment. Keep the overall path readable.
    $segments = $Path.Replace('\', '/').Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
    $encoded = foreach ($s in $segments) { [System.Uri]::EscapeDataString($s) }
    return ($encoded -join '/')
}

function Get-BlobPublicUrl {
    param(
        [string]$PublicUrlTemplate,
        [string]$BaseUrl,
        [string]$RelativePath
    )
    $urlPath = ConvertTo-UrlPath -Path $RelativePath
    $url = $PublicUrlTemplate.Replace('{baseUrl}', $BaseUrl.TrimEnd('/'))
    $url = $url.Replace('{relativePath}', $urlPath)
    return $url
}

function Send-BlobPutUpload {
    param(
        [string]$UploadEndpoint,
        [string]$RelativePath,
        [string]$ContentType,
        [string]$Token,
        [byte[]]$Bytes,
        [int]$RetryCount,
        [int[]]$RetryBackoffSeconds,
        [switch]$AddRandomSuffix
    )
    $urlPath = ConvertTo-UrlPath -Path $RelativePath
    $uri = $UploadEndpoint.TrimEnd('/') + '/?pathname=' + [System.Uri]::EscapeDataString($RelativePath)
    if ($AddRandomSuffix) { $uri = $uri + '&addRandomSuffix=1' }

    $req = [System.Net.HttpWebRequest]::Create($uri)
    $req.Method = 'PUT'
    $req.ContentType = 'application/octet-stream'
    $req.Headers['Authorization'] = "Bearer $Token"
    $req.Headers['x-content-type'] = $ContentType
    $req.Headers['x-vercel-blob-access'] = 'private'
    $req.Headers['x-api-version'] = '12'
    $req.ContentLength = $Bytes.Length
    $req.Timeout = 300000
    $req.ReadWriteTimeout = 300000
    $req.AllowAutoRedirect = $false
    $req.UserAgent = 'obsidian-migrate/1.0'

    for ($i = 0; $i -le $RetryCount; $i++) {
        $delaySec = 0
        if ($i -gt 0 -and $i -le $RetryBackoffSeconds.Count) { $delaySec = $RetryBackoffSeconds[$i - 1] }
        if ($delaySec -gt 0) {
            Start-Sleep -Seconds $delaySec
        }
        try {
            if ($req.ContentLength -eq 0) { $req.ContentLength = $Bytes.Length }
            $stream = $req.GetRequestStream()
            try {
                $stream.Write($Bytes, 0, $Bytes.Length)
            }
            finally { $stream.Dispose() }

            $resp = $req.GetResponse()
            try {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                try { $body = $reader.ReadToEnd() }
                finally { $reader.Dispose() }
                $json = $body | ConvertFrom-Json
                return [pscustomobject]@{
                    Success  = $true
                    Url      = $json.url
                    Pathname = if ($json.pathname) { $json.pathname } else { $urlPath }
                    Body     = $body
                }
            }
            finally { $resp.Dispose() }
        }
        catch [System.Net.WebException] {
            $ex = $_.Exception
            $resp = $ex.Response
            $status = -1
            $respBody = ''
            if ($null -ne $resp) {
                $status = [int]$resp.StatusCode
                try {
                    $r = New-Object System.IO.StreamReader($resp.GetResponseStream())
                    try { $respBody = $r.ReadToEnd() }
                    finally { $r.Dispose() }
                }
                catch { }
            }
            $retriable = $status -eq 429 -or $status -ge 500
            if (-not $retriable -and $status -gt 0) {
                # 4xx other than 429 = hard failure
                return [pscustomobject]@{
                    Success = $false
                    Url     = $null
                    Pathname = $null
                    Status  = $status
                    Error   = "HTTP $status $respBody"
                    Body    = $respBody
                }
            }
            if ($i -eq $RetryCount) {
                return [pscustomobject]@{
                    Success = $false
                    Url     = $null
                    Pathname = $null
                    Status  = $status
                    Error   = "HTTP $status $respBody (retries exhausted)"
                    Body    = $respBody
                }
            }
        }
        catch {
            if ($i -eq $RetryCount) {
                return [pscustomobject]@{
                    Success = $false
                    Url     = $null
                    Pathname = $null
                    Status  = -1
                    Error   = $_.Exception.Message
                    Body    = ''
                }
            }
        }
    }
    return [pscustomobject]@{ Success = $false; Url = $null; Pathname = $null; Status = -1; Error = 'Unknown upload failure'; Body = '' }
}