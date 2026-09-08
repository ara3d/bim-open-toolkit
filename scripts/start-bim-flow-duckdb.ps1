param(
    [string]$Database,
    [int]$HostPort = 5218,
    [int]$WebPort = 5308,
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$output = Join-Path $repo 'artifacts/bim-flow-duckdb'
if (-not $Database) { $Database = Join-Path $repo 'artifacts/building-model-workflows/snowdon-cli.duckdb' }
$Database = (Resolve-Path -LiteralPath $Database).Path
foreach ($port in @($HostPort, $WebPort)) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $port)
        throw "Port $port is already in use. Choose other -HostPort and -WebPort values."
    } catch [System.Net.Sockets.SocketException] { }
    finally { $client.Dispose() }
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
node (Join-Path $PSScriptRoot 'prepare-bim-flow-duckdb.mjs') $Database (Join-Path $output 'store')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare workflow graphs.' }
if (-not $SkipBuild) {
    dotnet build (Join-Path $repo 'src/BimOpenFlow.Host') --no-restore -o (Join-Path $output 'host') --verbosity quiet
    if ($LASTEXITCODE -ne 0) { throw 'Host build failed.' }
}
$hostDll = Join-Path $output 'host/bimopenflow-host.dll'
$vite = Join-Path $repo 'bimopenflow/web/node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $hostDll)) { throw 'Host is missing. Run without -SkipBuild.' }
if (-not (Test-Path -LiteralPath $vite)) { throw 'Install bimopenflow/web dependencies first.' }
$backend = $null
$frontend = $null
$previousHost = $env:BOF_DUCKDB_HOST
try {
    $backend = Start-Process dotnet -WindowStyle Hidden -PassThru -WorkingDirectory $repo -ArgumentList @(
        ('"' + $hostDll + '"'), '--profile', 'tables', '--port', $HostPort,
        '--store', ('"' + (Join-Path $output 'store') + '"'),
        '--cache', ('"' + (Join-Path $output 'cache') + '"'),
        '--models', ('"' + (Split-Path $Database -Parent) + '"')
    ) -RedirectStandardOutput (Join-Path $output 'host.log') -RedirectStandardError (Join-Path $output 'host.err.log')
    $env:BOF_DUCKDB_HOST = "http://127.0.0.1:$HostPort"
    $frontend = Start-Process node -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $repo 'bimopenflow/web/packages/app') -ArgumentList @(
        ('"' + $vite + '"'), '--config', 'vite.duckdb.config.ts', '--port', $WebPort, '--strictPort'
    ) -RedirectStandardOutput (Join-Path $output 'web.log') -RedirectStandardError (Join-Path $output 'web.err.log')
    foreach ($url in @("http://127.0.0.1:$HostPort/api/analyses", "http://127.0.0.1:$WebPort/duckdb.html")) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            if ($backend.HasExited -or $frontend.HasExited) { throw "A demo process exited. Check logs in $output." }
            try { Invoke-WebRequest $url -TimeoutSec 1 | Out-Null; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $ready) { throw "Demo did not become ready: $url. Check logs in $output." }
    }
    @{ hostPid = $backend.Id; webPid = $frontend.Id; hostPort = $HostPort; webPort = $WebPort; database = $Database } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'processes.json')
    Write-Output "Open http://127.0.0.1:$WebPort/duckdb.html"
    Write-Output "Host PID: $($backend.Id); web PID: $($frontend.Id). Logs: $output"
} catch {
    if ($frontend -and -not $frontend.HasExited) { $frontend.Kill() }
    if ($backend -and -not $backend.HasExited) { $backend.Kill() }
    throw
} finally { $env:BOF_DUCKDB_HOST = $previousHost }
