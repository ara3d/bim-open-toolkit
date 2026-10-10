---
id: TKT-171
title: BCF 3.0 export: issues with viewpoints and element GlobalIds from a check's failing rows
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Bcf/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests/**]
workflow: [W3]
created: 2026-10-10
---

## Acceptance criteria

- [ ] A library call writes a .bcf zip (BCF 3.0: bcf.version, extensions.xml, one folder per topic with markup.bcf and a viewpoint.bcfv) from a list of issues, each a title, description, and the GlobalIds of its elements
- [ ] Each viewpoint selects its elements and frames a perspective camera on their bounding box when geometry is given; without geometry it has components only, never an invented camera
- [ ] A test builds issues from samples/public/duplex.bos (for example every door) and the written XML validates against the buildingSMART BCF 3.0 XSDs
- [ ] Issue input is a table (rows of GlobalId plus a grouping or title column), so an IDS verdict table or a SQL result becomes topics without custom code

BCF (BIM Collaboration Format) is how Revit, Solibri, BIMcollab and others exchange issues; a rule check or IDS result as BCF reaches people who will never open the toolkit. Serves workflow 3. The MCP tool, solution entry, and README line are supervisor integration. Format survey: chat 2026-10-08.
