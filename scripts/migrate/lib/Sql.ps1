Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-MigrateSql {
    param([string]$ConnectionString)
    # System.Data.SqlClient requires the canonical keyword; preserve the supplied connection string otherwise.
    $normalizedConnectionString = $ConnectionString.Replace('Multiple Active Result Sets=', 'MultipleActiveResultSets=').Replace('Trust Server Certificate=', 'TrustServerCertificate=') -replace '(?i);?Command Timeout\s*=\s*[^;]*', ''
    $conn = [System.Data.SqlClient.SqlConnection]::new($normalizedConnectionString)
    $conn.Open()
    return $conn
}

function Invoke-MigrateNonQuery {
    param(
        [Parameter(Mandatory)][System.Data.SqlClient.SqlConnection]$Connection,
        [Parameter(Mandatory)][string]$CommandText,
        [System.Collections.Hashtable]$Parameters
    )
    $cmd = $Connection.CreateCommand()
    $cmd.CommandText = $CommandText
    $cmd.CommandTimeout = 0
    if ($Parameters) {
        foreach ($k in $Parameters.Keys) {
            $v = $Parameters[$k]
            if ($null -eq $v) { $v = [DBNull]::Value }
            [void]$cmd.Parameters.AddWithValue("$k", $v)
        }
    }
    try {
        return $cmd.ExecuteNonQuery()
    }
    finally {
        $cmd.Dispose()
    }
}

function Invoke-MigrateScalar {
    param(
        [Parameter(Mandatory)][System.Data.SqlClient.SqlConnection]$Connection,
        [Parameter(Mandatory)][string]$CommandText,
        [System.Collections.Hashtable]$Parameters
    )
    $cmd = $Connection.CreateCommand()
    $cmd.CommandText = $CommandText
    $cmd.CommandTimeout = 0
    if ($Parameters) {
        foreach ($k in $Parameters.Keys) {
            $v = $Parameters[$k]
            if ($null -eq $v) { $v = [DBNull]::Value }
            [void]$cmd.Parameters.AddWithValue("$k", $v)
        }
    }
    try {
        return $cmd.ExecuteScalar()
    }
    finally {
        $cmd.Dispose()
    }
}

function Invoke-MigrateReader {
    param(
        [Parameter(Mandatory)][System.Data.SqlClient.SqlConnection]$Connection,
        [Parameter(Mandatory)][string]$CommandText
    )
    $cmd = $Connection.CreateCommand()
    $cmd.CommandText = $CommandText
    $cmd.CommandTimeout = 0
    $list = New-Object System.Collections.Generic.List[object]
    $reader = $cmd.ExecuteReader()
    try {
        while ($reader.Read()) {
            $row = [ordered]@{}
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $name = $reader.GetName($i)
                $val = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
                $row[$name] = $val
            }
            $list.Add([pscustomobject]$row)
        }
    }
    finally {
        $reader.Dispose()
        $cmd.Dispose()
    }
    return $list
}

function Get-ExistingIdsFromTable {
    param(
        [Parameter(Mandatory)][System.Data.SqlClient.SqlConnection]$Connection,
        [Parameter(Mandatory)][string]$Table
    )
    $rows = Invoke-MigrateReader -Connection $Connection -CommandText "SELECT Id FROM [$Table]"
    $ids = New-Object System.Collections.Generic.HashSet[string]
    foreach ($row in $rows) { [void]$ids.Add([string]$row.Id) }
    Write-Output -NoEnumerate $ids
}