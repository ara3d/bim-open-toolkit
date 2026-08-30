# Populates data/ with the IFC Test Kit fixtures.
# Test/model data is never committed to this repo (.gitignore excludes data/**).
# Source: local clone of nrc-ifc-llm (an NRC deliverable that keeps its own copy).
param(
    [string]$Source = "$PSScriptRoot\..\..\nrc-ifc-llm\IFC-Test-Kit"
)
if (-not (Test-Path $Source)) {
    Write-Error "IFC Test Kit not found at $Source. Clone nrc-ifc-llm beside this repo, or pass -Source."
    exit 1
}
Copy-Item -Path (Join-Path $Source '*') -Destination $PSScriptRoot -Recurse -Force
Write-Host "Copied IFC Test Kit fixtures from $Source into $PSScriptRoot"
