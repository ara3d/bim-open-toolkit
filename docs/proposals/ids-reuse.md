# IDS: what to reuse and what to build

Written 2026-09-27 for TKT-50 (proposal P3 in [nrc-deliverables.md](nrc-deliverables.md)).
The question: what should read buildingSMART IDS 1.0 files (Information Delivery
Specification) and evaluate them over the toolkit's BIM Open Schema (BOS) tables in DuckDB?

## Verdicts

| Piece | Verdict | Where | Searched |
|---|---|---|---|
| Parse an IDS 1.0 file into an object model | adopt dependency | `Xbim.InformationSpecifications` 1.0.24, `Xids.LoadBuildingSmartIDS(path)` | .NET BCL (`System.Xml.Linq` would do the XML but not the value semantics); repo: "ids", "InformationSpecifications", "xbim" (no hit; no project references xbim); sibling repos under `C:\Users\cdigg\git` (no `.ids` file, no IDS reader); NuGet search "ids", "xbim ids" |
| Evaluate IDS facets over BOS tables in DuckDB | build, in `src/data/Ara3D.Ids`, reusing `ValueConstraint.IsSatisfiedBy` from the package above | none fits: every evaluator found walks an IFC object model | NuGet `Xbim.IDS.Validator.*`; PyPI `ifctester`; repo `check.rule`, `check.required` (verdict shape only, no IDS) |
| Audit an IDS file against the IDS 1.0 XSD and its content rules | adopt dependency (test project only) | `ids-lib` 1.0.124, `IdsLib.Audit.Run`; already a transitive dependency of the parser | NuGet search "ids"; buildingSMART `IDS-Audit-tool` repository |
| Reference implementation for parity | reuse as an external tool | IfcOpenShell `ifctester` 0.8.5, driven by `tests/data/Ara3D.Ids.Tests/parity/run-ifctester.py` | PyPI; IfcOpenShell documentation |

No library evaluates over BOS, so the evaluation is built. The plan stands as written.

## How each claim was checked

### Xbim.InformationSpecifications (the parser)

- **Licence:** CDDL-1.0. Checked in the nuspec of 1.0.24 (`<license type="expression">CDDL-1.0</license>`)
  and in the repository's `LICENSE.md` (github.com/CBenghi/Xbim.Xids, headed "XBIM Licence /
  Common Development and Distribution License"). CDDL is a file-level copyleft: the toolkit
  (MIT) may reference the unmodified package; any change to the package's own source files
  would have to be published under CDDL. The toolkit changes none.
- **Target frameworks and weight:** `net8.0` and `netstandard2.0` (nuspec dependency groups).
  Dependencies: `ids-lib` (>= 1.0.112, MIT), `System.Text.Json`, `System.IO.Compression.ZipFile`.
  The DLL is 150 KB; `ids-lib` is 3.3 MB because it embeds IFC schema metadata and the IDS XSD.
  Nothing from the xbim IFC stack (`Xbim.Essentials`, `Xbim.Ifc4`) is pulled in, so it is usable
  without xbim's IFC model: confirmed by unpacking the 1.0.24 package and reading its nuspec.
- **Maintenance:** 1.0.24 was published 2026-05-05 (NuGet registration); a 1.1.0 preview line
  continued to 2026-07-04; the repository was last pushed 2026-08-03 (GitHub API). It tracks
  buildingSMART's IDS repository and is the parser inside xbim's IDS validator.
- **What it gives us:** the whole IDS 1.0 facet set as types (`IfcTypeFacet`, `IfcPropertyFacet`,
  `AttributeFacet`, `IfcClassificationFacet`, `MaterialFacet`, `PartOfFacet`), each requirement's
  cardinality (`FacetGroup.RequirementOptions`), the specification's `MinMaxCardinality`, and
  `ValueConstraint.IsSatisfiedBy`, which carries IDS's value rules (enumerations, patterns, bounds,
  lengths, the real-number tolerance). A reader of our own would reproduce the value rules, the
  fiddliest part of the standard; the unsupported facets arrive as named types, so the evaluator
  can name them in a warning.
- **Why not build the reader:** a subset reader over `System.Xml.Linq` is about 200 lines, but the
  value semantics would be ours to get right and to keep in step with IDS revisions.

### Xbim.IDS.Validator (xbim's evaluator), rejected

- **Licence:** AGPL-3.0-only (nuspec of `Xbim.IDS.Validator.Core` 1.0.187 and of
  `Xbim.IDS.Validator.Common` 1.0.187; GitHub API reports AGPL-3.0 for xBimTeam/Xbim.IDS.Validator).
  Incompatible with shipping the toolkit under MIT.
- **Fit:** `Xbim.IDS.Validator.Common` depends on `Xbim.Essentials` 6.0.578; it validates an xbim
  `IModel`, not tables. Using it would mean a second IFC stack beside web-ifc and BOS.

### ids-lib / IDS-Audit-tool (the auditor)

- **Licence:** MIT (nuspec of 1.0.124; GitHub API for buildingSMART/IDS-Audit-tool, last pushed
  2026-08-09).
- **Scope:** audits IDS files, not models. The package embeds `ids.xsd` (resource
  `IdsLib.Resources.XsdSchemas.ids.xsd`, found by scanning the DLL) and runs XSD validation plus
  content checks (known entity names, data types, property set names) through `IdsLib.Audit.Run`.
  This is how the test project validates the two sample IDS files against the IDS 1.0 schema
  without a separate download.

### IfcOpenShell ifctester (the parity reference)

- **Licence:** LGPL-3.0-or-later (PyPI classifier). Version 0.8.5; depends on `ifcopenshell`,
  `xmlschema`, and others (PyPI metadata).
- **Scope:** Python; reads IDS and evaluates it over an `ifcopenshell` model, and validates the
  IDS file against the XSD with `xmlschema` as it loads. It is the checker the paper's handoff
  list names (`nrc-ifc-llm/paper/handoff-needs.md`, item I4), so it is the parity reference, not
  a dependency.

## Running the parity check

`tests/data/Ara3D.Ids.Tests/parity/run-ifctester.py` runs ifctester over an IFC file and one or
more IDS files, and prints the pass and fail counts per specification in the same shape the
Ara3D.Ids tests print. It needs Python 3 with `ifctester` installed (`python -m pip install ifctester`,
which brings `ifcopenshell`).

```
python tests/data/Ara3D.Ids.Tests/parity/run-ifctester.py samples/nrc/duplex-enriched.ifc samples/nrc/ids/nrc-analytics.ids samples/nrc/ids/dc-w1.ids
```
