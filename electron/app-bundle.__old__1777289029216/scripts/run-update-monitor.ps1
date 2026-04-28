Param(
  [string]$BaseUrl = "http://127.0.0.1:8787"
)

$scriptPath = Join-Path $PSScriptRoot "run-update-monitor.cjs"
node $scriptPath $BaseUrl
exit $LASTEXITCODE
