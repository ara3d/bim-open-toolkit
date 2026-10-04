---
id: TKT-146
title: The IFC to BOS conversion never returns on a model with no IfcUnitAssignment
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.IfcLoader/**, deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**]
kind: defect
---

## Acceptance criteria

- [ ] A hand-written IFC4 fixture whose IfcProject has no UnitsInContext converts (ifc_sql answers) or fails with a message, within seconds
- [ ] A test in bim-open-data reproduces the hang before the fix

Found 2026-10-04 while writing TKT-145 fixtures in bim-open-data. A two-pipe IFC4 file whose IFCPROJECT had `$` for UnitsInContext made the first ifc_sql call spin at full CPU in the test host for over ten minutes (the stdio server exited without a reply). Adding `IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)` and an IFCUNITASSIGNMENT made it convert in under a second. The conversion opens the file with geometry (`new IfcFile(input, true)`, web-ifc), so the loop is probably in the geometry load or IfcLengthUnit.Read; not isolated. Code lives in bim-open-data (src/data); fix it there and update the toolkit's deps.json pin. Real exports always carry units, so the risk is to fixtures and hand-made files, and to an agent that opens one: the MCP call never returns.
