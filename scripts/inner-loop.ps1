# A builder's inner loop (TKT-321, docs/plans/build-times.md): one incremental
# build of a test project into the session's artifacts path, then the focused
# tests with --no-build, with the duration of each step printed for the report.
# The full test project and the corpus run belong to the close of a chunk, not
# to every edit: pass -Full at close.
#
#   powershell -File scripts/inner-loop.ps1 -Project deps/bim-open-data/tests/data/Ara3D.Step.Decode.Tests -Filter "FullyQualifiedName~WitnessTests"
#   powershell -File scripts/inner-loop.ps1 -Project ... -Full
#
# The artifacts path defaults to artifacts/builders/<CLAUDE_CODE_SESSION_ID or user>,
# one per session so the cold build is paid once, not once per chunk.
param(
    [Parameter(Mandatory = $true)][string]$Project,
    [string]$Filter = '',
    [string]$ArtifactsPath = '',
    [switch]$Full,
    [string[]]$BuildArgs = @()
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $ArtifactsPath) {
    $who = if ($env:CLAUDE_CODE_SESSION_ID) { $env:CLAUDE_CODE_SESSION_ID.Substring(0, 8) } else { $env:USERNAME }
    $ArtifactsPath = Join-Path $root "artifacts\builders\$who"
}
$timings = @()
function Step([string]$name, [scriptblock]$body) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    & $body
    $code = $LASTEXITCODE
    $sw.Stop()
    $script:timings += "{0} {1:F1} s" -f $name, $sw.Elapsed.TotalSeconds
    if ($code -ne 0) { Write-Host ("durations: " + ($script:timings -join ', ')); exit $code }
}
$extra = @('-nodeReuse:false', '-nologo') + $BuildArgs
Step 'build' { dotnet build $Project --artifacts-path $ArtifactsPath -v:minimal @extra }
if ($Full) {
    Step 'test-full' { dotnet test $Project --artifacts-path $ArtifactsPath --no-build @extra }
} elseif ($Filter) {
    Step 'test-focused' { dotnet test $Project --artifacts-path $ArtifactsPath --no-build --filter $Filter @extra }
}
Write-Host ("durations: " + ($timings -join ', '))
