# Packs the Ara3D SDK at its pinned commit (deps.json) into a local NuGet feed,
# deps/ara3d-sdk-packages/<commit>/, once per pin (TKT-321). Directory.Build.targets
# in this repository and in deps/bim-open-data then restore the SDK as packages
# versioned <Ara3DSdkVersion>-pin<commit8> instead of compiling it from source
# in every cold build. Build with -p:Ara3DSdkFromSource=true (or the environment
# variable ARA3D_SDK_FROM_SOURCE=true) to compile from source again, for example
# when a ticket's fence includes deps/ara3d-sdk.
#
#   powershell -File scripts/pack-ara3d-sdk.ps1          # no-op when the feed for the pin exists
#   powershell -File scripts/pack-ara3d-sdk.ps1 -Force   # repack
param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$sdk = Join-Path $Root 'deps\ara3d-sdk'
$deps = Get-Content (Join-Path $Root 'deps.json') -Raw | ConvertFrom-Json
$pin = $deps.'ara3d-sdk'.commit
if (-not $pin) { throw "deps.json has no ara3d-sdk commit" }
$head = (& git -C $sdk rev-parse HEAD).Trim()
if ($head -ne $pin) { throw "deps/ara3d-sdk is at $head, deps.json pins $pin; run 'node deps.mjs' first" }
$dirty = & git -C $sdk status --porcelain -- src ext wip
if ($dirty) { throw "deps/ara3d-sdk has uncommitted changes; a feed must be built from the pinned tree:`n$($dirty -join "`n")" }

$props = Get-Content (Join-Path $Root 'Directory.Build.props') -Raw
$sdkVersion = [regex]::Match($props, '<Ara3DSdkVersion>([^<]+)</Ara3DSdkVersion>').Groups[1].Value
$version = "$sdkVersion-pin$($pin.Substring(0, 8))"
$feed = Join-Path $Root "deps\ara3d-sdk-packages\$pin"
if ((Test-Path $feed) -and -not $Force -and (Get-ChildItem $feed -Filter '*.nupkg' | Measure-Object).Count -gt 0) {
    Write-Host "feed exists: $feed ($version); pass -Force to repack"
    exit 0
}

# Every library project under src/, ext/, and wip/: the same set Directory.Build.targets rewrites.
$manifest = Join-Path $env:TEMP "ara3d-sdk-pack-manifest-$($pin.Substring(0, 8)).txt"
Get-ChildItem (Join-Path $sdk 'src'), (Join-Path $sdk 'ext'), (Join-Path $sdk 'wip') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ChildItem $_.FullName -Filter '*.csproj' } |
    ForEach-Object { $_.FullName.Substring($sdk.Length + 1) } |
    Set-Content -Encoding ascii $manifest

New-Item -ItemType Directory -Force $feed | Out-Null
Write-Host "packing deps/ara3d-sdk $($pin.Substring(0, 8)) as $version into $feed"
$sw = [Diagnostics.Stopwatch]::StartNew()
# PackAll.proj refuses wip/ in packages.txt, so wip/ projects are packed in a second pass; most are not packable and pack nothing.
$packAll = Join-Path $sdk 'build\PackAll.proj'
$srcManifest = Join-Path $env:TEMP "ara3d-sdk-pack-manifest-src-$($pin.Substring(0, 8)).txt"
Get-Content $manifest | Where-Object { $_ -notmatch '^wip[\\/]' } | Set-Content -Encoding ascii $srcManifest
& dotnet msbuild $packAll -t:PackAll "-p:PackagesManifest=$srcManifest" -p:Configuration=Release "-p:Version=$version" "-p:PackageOutputPath=$feed" -p:ContinuousIntegrationBuild=false -nodeReuse:false -m -v:minimal -nologo
if ($LASTEXITCODE -ne 0) { throw "packing failed ($LASTEXITCODE)" }
$wip = Get-Content $manifest | Where-Object { $_ -match '^wip[\\/]' }
foreach ($p in $wip) {
    & dotnet pack (Join-Path $sdk $p) -c Release "-p:Version=$version" "-p:PackageOutputPath=$feed" -nodeReuse:false -v:quiet -nologo
    if ($LASTEXITCODE -ne 0) { Write-Warning "wip project $p did not pack; it stays a project reference" }
}
$sw.Stop()
$count = (Get-ChildItem $feed -Filter '*.nupkg' | Measure-Object).Count
Write-Host "$count packages, $([math]::Round($sw.Elapsed.TotalSeconds)) s"
