---
id: TKT-171
title: BCF 3.0 export: issues with viewpoints and element GlobalIds from a check's failing rows
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Bcf/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests/**]
workflow: [W3]
created: 2026-10-10
closed: 2026-10-10
---

## Acceptance criteria

- [x] A library call writes a .bcf zip (BCF 3.0: bcf.version, extensions.xml, one folder per topic with markup.bcf and a viewpoint.bcfv) from a list of issues, each a title, description, and the GlobalIds of its elements
- [x] Each viewpoint selects its elements and frames a perspective camera on their bounding box when geometry is given; without geometry the topic gets no viewpoint (BCF 3.0 requires a camera in every viewpoint, visinfo.xsd) and its GlobalIds go in the description, never an invented camera (corrected 2026-10-10 after the build found the schema rule)
- [x] A test builds issues from samples/public/duplex.bos (for example every door) and the written XML validates against the buildingSMART BCF 3.0 XSDs
- [x] Issue input is a table (rows of GlobalId plus a grouping or title column), so an IDS verdict table or a SQL result becomes topics without custom code

BCF (BIM Collaboration Format) is how Revit, Solibri, BIMcollab and others exchange issues; a rule check or IDS result as BCF reaches people who will never open the toolkit. Serves workflow 3. The MCP tool, solution entry, and README line are supervisor integration. Format survey: chat 2026-10-08.

Done 2026-10-10 in ara3d/bim-open-data: `edb93a0` (writer), `3998d55` (validate, then atomic write), `b83ea5d` (characters XML cannot hold), MCP tool `bos_export_bcf` in `8db3659` and `0e92cb9`. Every written file validates against the BCF 3.0 XSDs.
