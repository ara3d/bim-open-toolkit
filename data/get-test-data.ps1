# Populates this repository's data/ with test fixtures, using bim-open-data's fetch script
# (deps/bim-open-data/data/get-test-data.ps1; run `node deps.mjs` first). Nothing here is
# ever committed (.gitignore excludes data/** except this script and README.md).
param(
    [string]$TestKit = "$PSScriptRoot\..\..\nrc-ifc-llm\IFC-Test-Kit",
    [string]$SdkData = "$PSScriptRoot\..\..\studio\ara3d-sdk\data"
)

$fetch = Join-Path $PSScriptRoot '..\deps\bim-open-data\data\get-test-data.ps1'
if (-not (Test-Path $fetch)) { throw "Not found: $fetch. Run node deps.mjs first." }
& $fetch -TestKit $TestKit -SdkData $SdkData -Destination $PSScriptRoot
