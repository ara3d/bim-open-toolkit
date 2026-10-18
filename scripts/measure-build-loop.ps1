# Times one builder loop in bim-open-data (TKT-321): a cold build into a fresh
# artifacts path, a no-change rebuild, focused tests, the full test project, and
# an optional corpus program, and writes a Markdown report with the MSBuild
# performance summary (project, target, task costs) of the cold build.
#
#   powershell -File scripts/measure-build-loop.ps1 -Label before
#   powershell -File scripts/measure-build-loop.ps1 -Label before-x3 -Concurrent 3
#   ... -CorpusProject <csproj> -CorpusDir <folder of .stp files>
#
# -Concurrent N starts N cold builds at once, each into its own artifacts path,
# as N builders would; the later steps run on the first one. Results go to
# -OutDir (default: the user's temp folder, build-times\<Label>).
param(
    [string]$Repo = (Join-Path $PSScriptRoot '..\deps\bim-open-data'),
    [string]$Project = 'tests/data/Ara3D.Step.Decode.Tests',
    [string]$Filter = 'FullyQualifiedName~WitnessTests',
    [string]$Label = 'run',
    [string]$OutDir = (Join-Path $env:TEMP 'build-times'),
    [int]$Concurrent = 1,
    [string]$CorpusProject = '',
    [string]$CorpusDir = '',
    [switch]$SkipFullTests,
    [string[]]$BuildArgs = @()
)
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path $Repo).Path
$out = Join-Path $OutDir $Label
New-Item -ItemType Directory -Force $out | Out-Null
$projectPath = Join-Path $Repo $Project
$report = Join-Path $out 'report.md'
$rows = @()

function Load { (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average }
function Procs { (Get-Process -Name dotnet, MSBuild, VBCSCompiler -ErrorAction SilentlyContinue | Measure-Object).Count }

function Step([string]$name, [scriptblock]$body) {
    $load = Load; $procs = Procs
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $exit = & $body
    $sw.Stop()
    $script:rows += [pscustomobject]@{ step = $name; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1); exit = $exit; loadBefore = $load; procsBefore = $procs }
    Write-Host ("{0,-22} {1,8:F1} s  exit {2}  load {3}%  dotnet procs {4}" -f $name, $sw.Elapsed.TotalSeconds, $exit, $load, $procs)
}

function Art([int]$i) { Join-Path $out "art-$i" }

# Cold builds: N at once, each into a fresh artifacts path.
Step "build-cold x$Concurrent" {
    $procsList = @()
    for ($i = 1; $i -le $Concurrent; $i++) {
        $art = Art $i
        if (Test-Path $art) { Remove-Item -Recurse -Force $art }
        $log = Join-Path $out "build-cold-$i.log"
        $args = @('build', $projectPath, '--artifacts-path', $art, "-bl:$(Join-Path $out "build-cold-$i.binlog")", '-clp:PerformanceSummary;Verbosity=quiet', '-nologo') + $BuildArgs
        $procsList += Start-Process dotnet -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $log
    }
    $procsList | Wait-Process
    $exit = 0
    foreach ($p in $procsList) {
        $secs = [math]::Round(($p.ExitTime - $p.StartTime).TotalSeconds, 1)
        Write-Host ("  build $($p.Id): $secs s, exit $($p.ExitCode)")
        $script:rows += [pscustomobject]@{ step = "  cold build #$($procsList.IndexOf($p) + 1)"; seconds = $secs; exit = $p.ExitCode; loadBefore = ''; procsBefore = '' }
        if ($p.ExitCode -ne 0) { $exit = $p.ExitCode }
    }
    $exit
}

$art1 = Art 1
Step 'build-nochange' {
    dotnet build $projectPath --artifacts-path $art1 "-bl:$(Join-Path $out 'build-nochange.binlog')" -clp:'PerformanceSummary;Verbosity=quiet' -nologo @BuildArgs > (Join-Path $out 'build-nochange.log')
    $LASTEXITCODE
}

Step 'test-focused' {
    dotnet test $projectPath --artifacts-path $art1 --no-build --filter $Filter -nologo @BuildArgs > (Join-Path $out 'test-focused.log')
    $LASTEXITCODE
}

if (-not $SkipFullTests) {
    Step 'test-full' {
        dotnet test $projectPath --artifacts-path $art1 --no-build -nologo @BuildArgs > (Join-Path $out 'test-full.log')
        $LASTEXITCODE
    }
}

if ($CorpusProject) {
    Step 'corpus-build' {
        dotnet build $CorpusProject -c Release --artifacts-path $art1 "-bl:$(Join-Path $out 'corpus-build.binlog')" -clp:'PerformanceSummary;Verbosity=quiet' -nologo @BuildArgs > (Join-Path $out 'corpus-build.log')
        $LASTEXITCODE
    }
    $dll = Get-ChildItem -Recurse (Join-Path $art1 'bin') -Filter ([IO.Path]::GetFileNameWithoutExtension($CorpusProject) + '.dll') | Where-Object FullName -match 'release' | Select-Object -First 1
    Step 'corpus-run' {
        dotnet $dll.FullName $CorpusDir > (Join-Path $out 'corpus-run.log')
        $LASTEXITCODE
    }
}

# Report: the timings, then the top costs from the cold build's performance summary.
function TopOf([string]$log, [string]$heading, [int]$n) {
    # Rows of one summary section: top-level rows are indented by at most 8 spaces; nested target rows by more.
    $items = @()
    $inSection = $false
    foreach ($line in Get-Content $log) {
        if ($line -match '^\S.*Summary:$') { $inSection = ($line -eq "${heading}:"); continue }
        if ($inSection -and $line -match '^\s{1,8}(\d+) ms\s+(.+?)\s+(\d+) calls') { $items += [pscustomobject]@{ ms = [int]$matches[1]; name = $matches[2].Trim(); calls = [int]$matches[3] } }
    }
    $items | Sort-Object ms -Descending | Select-Object -First $n
}

$md = @()
$md += "# Build loop: $Label"
$md += ''
$md += "Measured $(Get-Date -Format 'yyyy-MM-dd HH:mm') on $env:COMPUTERNAME ($([Environment]::ProcessorCount) threads), repo $Repo, project $Project, $Concurrent concurrent cold build(s)."
$md += ''
$md += '| Step | Seconds | Exit | CPU load before (%) | dotnet/MSBuild processes before |'
$md += '|---|---|---|---|---|'
foreach ($r in $rows) { $md += "| $($r.step) | $($r.seconds) | $($r.exit) | $($r.loadBefore) | $($r.procsBefore) |" }
$md += ''
$coldLog = Join-Path $out 'build-cold-1.log'
foreach ($section in @(@('Project Performance Summary', 12), @('Target Performance Summary', 10), @('Task Performance Summary', 10))) {
    $md += "## $($section[0]) (cold build #1, top $($section[1]))"
    $md += ''
    $md += '| ms | Name | Calls |'
    $md += '|---|---|---|'
    foreach ($t in TopOf $coldLog $section[0] $section[1]) { $md += "| $($t.ms) | $($t.name) | $($t.calls) |" }
    $md += ''
}
$md | Set-Content -Encoding utf8 $report
Write-Host "report: $report"
