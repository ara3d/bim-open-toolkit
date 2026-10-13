# Notice for the Snowdon Towers sample

The code in this repository is MIT licensed (`LICENSE` at the root). The Snowdon Towers building data is Autodesk's and keeps its own licence.

- Source: Snowdon Towers Sample Project, Autodesk, Inc., from the Revit sample project files, https://help.autodesk.com/view/RVT/2026/ENU/?guid=GUID-61EF2F22-3A1F-4317-B925-1E85F138BE88. Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0), https://creativecommons.org/licenses/by-nc-sa/3.0/. Copyright © Autodesk, Inc.
- Autodesk's Creative Commons FAQ (https://www.autodesk.com/company/creative-commons) places downloadable 3D assets under CC BY-NC-SA: noncommercial use, credit to Autodesk, and the same licence on what is built from them. Commercial use needs Autodesk's permission (creativecommons@autodesk.com).

The model files (`.rvt`, the IFC and BOS exports, the DuckDB export, `snowdon.bfast`) are never committed; each user supplies their own copy (see `README.md` in this folder). The repository does commit content computed from the model, which is a derivative work under CC BY-NC-SA 3.0 and is not covered by the MIT licence:

- `samples/notebooks/s10-snowdon.notebook.json`, `outlines/s10-snowdon.outline.json`, and `graphs/s10-snowdon/*.json`: the "Snowdon at scale" notebook, whose replies and embedded tables hold counts and names read from the model.
- `samples/ask/requests.txt`, `toolkit-requests.txt`, and `toolkit-transcript-2026-09-29.txt`: expected answers and a transcript computed over the Snowdon DuckDB export.
- `tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/snowdon-toolkit.txt`: a golden file with row counts from the model.
- `samples/snowdon-analyses/federation-confirmations.csv`: storey names of the discipline models, when filled.

The graphs themselves (`snowdon-toolkit.json`, `federation-match.json`, `samples/duckdb-analyses/workflows.json`) are Ara 3D's work and carry no model data.

A fork used commercially removes the derived files above or obtains Autodesk's permission. Studio 2.5's fork removed them on 2026-10-05.

Attribution:

> Snowdon Towers Sample Project, Autodesk, Inc., from the Revit sample project files, https://help.autodesk.com/view/RVT/2026/ENU/?guid=GUID-61EF2F22-3A1F-4317-B925-1E85F138BE88. Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0), https://creativecommons.org/licenses/by-nc-sa/3.0/. Copyright © Autodesk, Inc.
