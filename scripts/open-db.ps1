param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PsqlArgs
)

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

chcp 65001 > $null

$env:PGCLIENTENCODING = "UTF8"

if (-not $env:PGUSER) {
  $env:PGUSER = "postgres"
}

if (-not $env:PGDATABASE) {
  $env:PGDATABASE = "lms_operations_platform"
}

if ($PsqlArgs) {
  & psql @PsqlArgs
} else {
  psql
}
