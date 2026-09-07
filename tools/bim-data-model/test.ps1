[CmdletBinding()]
param(
    [ValidateSet('Small', 'All', 'Large', 'Samples', 'Analyzers')]
    [string] $Suite = 'Small',
    [string] $Feature,
    [string] $SampleDirectory,
    [string] $PlatonicRoot,
    [switch] $IncludeExperimental,
    [switch] $VerifyAnalyzers,
    [switch] $ShowFilter
)

$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$project = Join-Path $repository 'tests/Ara3D.BimOpenSchema.DataModel.Tests/Ara3D.BimOpenSchema.DataModel.Tests.csproj'
$outputDirectory = Join-Path $repository ('artifacts/bim-data-model/' + [Guid]::NewGuid().ToString('N'))
$conditions = @()
switch ($Suite)
{
    'Small' { $conditions += 'TestCategory=Size.Small'; $conditions += 'TestCategory!=Source.LocalSample' }
    'Large' { $conditions += 'TestCategory=Size.Large'; $conditions += 'TestCategory!=Source.LocalSample' }
    'Samples' { $conditions += 'TestCategory=Source.LocalSample' }
}
if (!$IncludeExperimental) { $conditions += 'TestCategory!=Stage.Experimental' }
if ($Feature)
{
    if ($Feature -notmatch '^[A-Za-z][A-Za-z0-9.]*$') { throw 'Feature must be a category name, for example Geometry or Feature.Geometry.' }
    if (!$Feature.StartsWith('Feature.')) { $Feature = 'Feature.' + $Feature }
    $conditions += 'TestCategory=' + $Feature
}
$filter = $conditions -join '&'
if ($ShowFilter) { Write-Output $filter; exit 0 }

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$buildProperties = @()
if ($PlatonicRoot) { $buildProperties += '-p:PlatonicRoot=' + [IO.Path]::GetFullPath($PlatonicRoot) }

function Invoke-Dotnet([string[]] $Arguments, [string] $LogName)
{
    $logPath = Join-Path $outputDirectory $LogName
    & dotnet @Arguments *> $logPath
    $code = $LASTEXITCODE
    if ($code -ne 0)
    {
        Get-Content -LiteralPath $logPath | Select-Object -Last 25 | Write-Output
        throw "FAIL: dotnet exited $code. Full log: $logPath"
    }
    return $logPath
}

if ($VerifyAnalyzers -or $Suite -eq 'Analyzers')
{
    $probeDirectory = Join-Path $outputDirectory 'analyzer-probe'
    New-Item -ItemType Directory -Path $probeDirectory -Force | Out-Null
    $propsPath = [Security.SecurityElement]::Escape((Join-Path $PSScriptRoot 'Platonic.props'))
    $probeProject = Join-Path $probeDirectory 'Probe.csproj'
    @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
  <Import Project="$propsPath" />
</Project>
"@ | Set-Content -LiteralPath $probeProject
    $probeSource = Join-Path $probeDirectory 'Probe.cs'
    'public sealed record Probe(int Value);' | Set-Content -LiteralPath $probeSource
    $null = Invoke-Dotnet (@('build', $probeProject, '--nologo', '-v:minimal') + $buildProperties) 'analyzer-clean.log'
    'public class Probe { public int Value { get; set; } }' | Set-Content -LiteralPath $probeSource
    $negativeLog = Join-Path $outputDirectory 'analyzer-negative.log'
    & dotnet build $probeProject --no-restore --nologo -v:minimal @buildProperties *> $negativeLog
    $negativeExitCode = $LASTEXITCODE
    $diagnostics = Get-Content -LiteralPath $negativeLog -Raw
    if ($negativeExitCode -eq 0 -or $diagnostics -notmatch 'error PURE001' -or $diagnostics -notmatch 'error PURE002')
    {
        throw "FAIL: analyzer sentinel did not reject mutable class/setter. Full log: $negativeLog"
    }
    Write-Output 'PASS: Platonic accepts immutable records and rejects mutable classes and setters.'
}
if ($Suite -eq 'Analyzers') { exit 0 }

$originalSamples = [Environment]::GetEnvironmentVariable('BOS_SAMPLE_DIRECTORY', 'Process')
try
{
    if ($SampleDirectory)
    {
        $resolvedSamples = (Resolve-Path -LiteralPath $SampleDirectory).Path
        [Environment]::SetEnvironmentVariable('BOS_SAMPLE_DIRECTORY', $resolvedSamples, 'Process')
    }
    $arguments = @('test', $project, '--nologo', '-v:minimal', '--results-directory', $outputDirectory, '--logger', 'trx;LogFileName=results.trx') + $buildProperties
    if ($filter) { $arguments += @('--filter', $filter) }
    $testLog = Invoke-Dotnet $arguments 'tests.log'
    $resultsPath = Join-Path $outputDirectory 'results.trx'
    if (!(Test-Path -LiteralPath $resultsPath)) { throw "FAIL: test runner produced no results. Full log: $testLog" }
    [xml] $results = Get-Content -LiteralPath $resultsPath -Raw
    $counters = $results.TestRun.ResultSummary.Counters
    if ([int] $counters.executed -eq 0) { throw "FAIL: no tests executed for filter '$filter'. Full log: $testLog" }
    Write-Output "PASS: $Suite; executed=$($counters.executed), passed=$($counters.passed), failed=$($counters.failed), skipped=$($counters.notExecuted). Results: $resultsPath"
}
finally
{
    [Environment]::SetEnvironmentVariable('BOS_SAMPLE_DIRECTORY', $originalSamples, 'Process')
}
