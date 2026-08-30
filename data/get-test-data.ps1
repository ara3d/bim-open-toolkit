# Populates data/ with test fixtures. Nothing here is ever committed
# (.gitignore excludes data/** except this script and README.md).
param(
    [string]$TestKit = "$PSScriptRoot\..\..\nrc-ifc-llm\IFC-Test-Kit",
    [string]$SdkData = "$PSScriptRoot\..\..\studio\ara3d-sdk\data"
)

# 1. IFC Test Kit (duplex.ifc, ground truth + analytics CSVs)
if (Test-Path $TestKit) {
    Get-ChildItem $TestKit | Where-Object { $_.Name -ne 'README.md' } |
        Copy-Item -Destination $PSScriptRoot -Recurse -Force
    Write-Host "Copied IFC Test Kit from $TestKit"
} else {
    Write-Warning "IFC Test Kit not found at $TestKit (clone nrc-ifc-llm beside this repo, or pass -TestKit)."
}

# 2. Sample models used by Harmonizer/BimOpenSchema/Mcp tests
$models = @('AC20-FZK-Haus.ifc', 'AC20-Institute-Var-2.ifc', 'model_0.ifc',
            'schependomlaan.ifc', 'rac_basic_sample_project-2025.bos')
if (Test-Path $SdkData) {
    foreach ($m in $models) {
        $src = Join-Path $SdkData $m
        if (Test-Path $src) { Copy-Item $src $PSScriptRoot -Force; Write-Host "Copied $m" }
        else { Write-Warning "$m not found in $SdkData" }
    }
} else {
    Write-Warning "ara3d-sdk data not found at $SdkData (pass -SdkData)."
}
