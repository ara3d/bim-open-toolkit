param(
    [string]$ModelPath = (Join-Path $env:USERPROFILE 'Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos'),
    [int]$HostPort = 5214,
    [int]$WebPort = 5300,
    [string]$Store = 'artifacts/bim-flow/store',
    [string]$Cache = 'artifacts/bim-flow/cache'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$model = (Resolve-Path -LiteralPath $ModelPath).Path
$run = Join-Path $repo ('artifacts/bim-flow/launch/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $repo 'bimopenflow/web/node_modules/vite/bin/vite.js'))) { throw 'Install bimopenflow/web dependencies first.' }
foreach ($port in @($HostPort, $WebPort)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. Stop its process or choose another port."
    }
}
New-Item -ItemType Directory -Force -Path $run | Out-Null
$env:BIMOPENFLOW_SNOWDON = $model
$env:BOF_HOST = "http://127.0.0.1:$HostPort"
$backend = $null
$frontend = $null
function Stop-LaunchProcess($process) {
    if ($process -and -not $process.HasExited) {
        & taskkill.exe /PID $process.Id /T /F | Out-Null
    }
}
try {
    $backend = Start-Process dotnet -WindowStyle Hidden -PassThru -WorkingDirectory $repo -ArgumentList @(
        'run', '--project', 'src/BimOpenFlow.Host', '--', '--profile', 'bim', '--port', $HostPort,
        '--store', (Join-Path $repo $Store), '--cache', (Join-Path $repo $Cache)
    ) -RedirectStandardOutput (Join-Path $run 'host.log') -RedirectStandardError (Join-Path $run 'host.err.log')
    $frontend = Start-Process npm.cmd -WindowStyle Hidden -PassThru -WorkingDirectory $repo -ArgumentList @(
        'run', 'dev', '--prefix', 'bimopenflow/web', '-w', '@bimopenflow/app', '--', '--port', $WebPort, '--strictPort'
    ) -RedirectStandardOutput (Join-Path $run 'web.log') -RedirectStandardError (Join-Path $run 'web.err.log')
    foreach ($url in @("http://127.0.0.1:$HostPort/api/analyses", "http://127.0.0.1:$WebPort/3d.html")) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 120; $attempt++) {
            if ($backend.HasExited -or $frontend.HasExited) { throw "A process exited. Check logs in $run." }
            try { Invoke-WebRequest $url -TimeoutSec 1 | Out-Null; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $ready) { throw "Service did not become ready: $url. Check logs in $run." }
    }
    @{ hostPid = $backend.Id; webPid = $frontend.Id; hostPort = $HostPort; webPort = $WebPort; logs = $run } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run 'processes.json')
    Write-Output "Open http://127.0.0.1:$WebPort/3d.html"
    Write-Output "Host PID: $($backend.Id); web PID: $($frontend.Id). Logs: $run"
} catch {
    Stop-LaunchProcess $frontend
    Stop-LaunchProcess $backend
    throw
}
