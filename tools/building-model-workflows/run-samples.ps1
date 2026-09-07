param(
    [switch]$Prepare,
    [string]$OutputRoot = (Join-Path $PSScriptRoot '../../artifacts/building-model-workflows')
)
$ErrorActionPreference = 'Stop'
$repository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$project = Join-Path $PSScriptRoot 'BuildingModel.Workflows.Cli.csproj'
$output = [System.IO.Path]::GetFullPath($OutputRoot)
$samples = @(
    @{ Name = 'all-medium'; Path = 'C:/data/nxt-bld/all-medium.bos'; Policy = $null },
    @{ Name = 'snowdon'; Path = 'C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos'; Policy = '--revit-internal' },
    @{ Name = 'golden-nugget'; Path = 'C:/Users/cdigg/Documents/BIM Open Schema/BIM_Projekt_Golden_Nugget-Architektur_und_Ingenieurbau.bos'; Policy = '--revit-internal' }
)
function Invoke-WorkflowCli([string[]]$Arguments) {
    & dotnet run --no-build --no-restore --project $project -- @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Workflow CLI failed: $($Arguments -join ' ')" }
}
New-Item -ItemType Directory -Force -Path (Join-Path $output 'cache') | Out-Null
$projections = @()
foreach ($sample in $samples) {
    $cache = Join-Path $output "cache/$($sample.Name).bfast"
    if ($Prepare) { Invoke-WorkflowCli -Arguments @('prepare', $sample.Path, $cache) }
    if (-not (Test-Path -LiteralPath $cache)) { throw "BFAST cache missing: $cache. Run with -Prepare first." }
    $report = Join-Path $output $sample.Name
    $arguments = @('run', $cache, $report)
    if ($sample.Policy) { $arguments += $sample.Policy }
    Invoke-WorkflowCli -Arguments $arguments
    $projection = Join-Path $report 'projection.json'
    $reopened = Join-Path $report 'reopened'
    Invoke-WorkflowCli -Arguments @('reopen', $projection, $reopened)
    foreach ($file in @('workflows.json', 'coverage.json', 'diagnostics.json')) {
        $originalHash = (Get-FileHash -LiteralPath (Join-Path $report $file) -Algorithm SHA256).Hash
        $reopenedHash = (Get-FileHash -LiteralPath (Join-Path $reopened $file) -Algorithm SHA256).Hash
        if ($originalHash -ne $reopenedHash) { throw "Reopening changed $file for $($sample.Name)." }
    }
    Write-Host "$($sample.Name): reopened results match byte-for-byte."
    $projections += $projection
}
Invoke-WorkflowCli -Arguments (@('portfolio', (Join-Path $output 'portfolio')) + $projections)
