# Downloads the curated public STEP test files (sandbox/step-brep-mesh/03-step/README.md, "Test files")
# into data/step-samples/, which .gitignore keeps out of the repository. Each source's terms are in
# data/README.md, section "STEP samples"; the script also writes data/step-samples/SOURCES.md with every
# file's URL and SHA-256. Files already present are kept, so a rerun only fetches what is missing.
# The owner approved the download on 2026-10-21 (TKT-313, chunk E5).
param(
    [string]$Destination = (Join-Path $PSScriptRoot '..\data\step-samples')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$stepTools = 'https://www.steptools.com/docs/stpfiles'
# Commits pinned so a rerun fetches the same bytes. The NASA file was removed from the repository's
# master after 463f2b29; u-blox is pinned at the commit the corpus runs used (3d-format-shootout's submodule).
$occt = 'https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/53706f78a8640c4407bdcc6752df13a270b159f2/data/step'
$ublox = 'https://raw.githubusercontent.com/u-blox/3D-Step-Models-Library/f3c136d200f21a07377a5d45bb9eaa0669a1128a'
$nasa = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/463f2b2941e3e95acfcbb12f783070e9d92ee267/3D%20Models/Regolith%20Advanced%20Surface%20Systems%20Operations%20Robot%20(RASSOR)'
$nistZip = 'https://www.nist.gov/system/files/documents/noindex/2024/06/19/NIST-PMI-STEP-Files.zip'

# Source folder, file name, URL.
$files = @(
    @('steptools-ap203', 'block.stp', "$stepTools/ap203/block.stp"),
    @('steptools-ap203', 'moon_buggy_asm.stp', "$stepTools/ap203/moon_buggy_asm.stp"),
    @('steptools-ap203', 'as1_pe.stp', "$stepTools/ap203/as1_pe.stp"),
    @('steptools-ap203', 'turbine.stp', "$stepTools/ap203/turbine.stp"),
    @('steptools-ap203', 'bull.stp', "$stepTools/ap203/bull.stp"),
    @('steptools-ap203', 'clip.stp', "$stepTools/ap203/clip.stp"),
    @('steptools-ap203', 'cubcylso.stp', "$stepTools/ap203/cubcylso.stp"),
    @('steptools-ap214', 'as1-ec-214.stp', "$stepTools/ap214/as1-ec-214.stp"),
    @('steptools-ap214', 'io1-tc-214.stp', "$stepTools/ap214/io1-tc-214.stp"),
    @('steptools-ap214', 'as1-ug-214.stp', "$stepTools/ap214/as1-ug-214.stp"),
    @('occt', 'screw.step', "$occt/screw.step"),
    @('occt', 'linkrods.step', "$occt/linkrods.step"),
    @('nasa', 'rassor_shrinkwrap.stp', "$nasa/rassor_shrinkwrap.stp")
) + (@('SHO/NORA-B101.step', 'SHO/IRIS-W1x1.step', 'SHO/ELLA-W1.STEP', 'SHO/NINA-B222-W1x2.STEP',
        'SHO/c211_case_with_odin_v1.step', 'SHO/ODIN-W260.STEP', 'SHO/THEO-P173.STEP', 'POS/ANN-MB2.step',
        'SHO/BMD-301.STEP', 'SHO/JODY-W3.STEP', 'CEL/LENA-R8.STEP', 'SHO/M2-JODY-W377-00C_PCIE-UART.step') |
    ForEach-Object { , @("u-blox/$(Split-Path $_ -Parent)", (Split-Path $_ -Leaf), "$ublox/$_") })

function Get-Once([string]$url, [string]$path) {
    if (Test-Path $path) { return }
    New-Item -ItemType Directory -Force (Split-Path $path -Parent) | Out-Null
    Write-Host "fetch $url"
    Invoke-WebRequest -Uri $url -OutFile "$path.part" -UseBasicParsing
    Move-Item "$path.part" $path
}

$rows = foreach ($f in $files) {
    $path = Join-Path $Destination (Join-Path $f[0] $f[1])
    Get-Once $f[2] $path
    , @("$($f[0])/$($f[1])", $f[2], $path)
}

# NIST: one zip with the CTC, FTC and STC parts as AP203 (geometry only and with PMI) and AP242.
$nistDir = Join-Path $Destination 'nist'
$zip = Join-Path $nistDir 'NIST-PMI-STEP-Files.zip'
Get-Once $nistZip $zip
if (-not (Get-ChildItem $nistDir -Recurse -Filter *.stp -ErrorAction SilentlyContinue)) {
    Expand-Archive $zip -DestinationPath $nistDir
}
$rows += Get-ChildItem $nistDir -Recurse -Filter *.stp | Sort-Object FullName | ForEach-Object {
    , @("nist/$($_.FullName.Substring((Resolve-Path $nistDir).Path.Length + 1).Replace('\', '/'))", "$nistZip (in the zip)", $_.FullName)
}

$lines = @(
    '# STEP samples',
    '',
    'Written by `scripts/fetch-step-samples.ps1`; never committed. Terms for each source: `data/README.md`, section "STEP samples".',
    '',
    '| File | Source URL | SHA-256 |',
    '|---|---|---|'
) + ($rows | ForEach-Object { "| ``$($_[0])`` | $($_[1]) | $((Get-FileHash $_[2] -Algorithm SHA256).Hash.ToLower()) |" })
Set-Content -Path (Join-Path $Destination 'SOURCES.md') -Value $lines -Encoding utf8
Write-Host "$($rows.Count) files in $Destination"
