---
id: TKT-144
title: Which sample building models may the public repositories redistribute, and with what attribution?
status: open
depends_on: []
owner:
fence: []
kind: question
---

Checked 2026-10-03, nothing settled. (1) Duplex (samples/nrc/duplex-*.ifc, also in nrc-ifc-llm and bim-open-data): STEP header says Revit Architecture 2011, 2011-09-07, Chicago; it matches Duplex_A_20110907 from the NIBS / US Army Corps ERDC 'Common BIM Files' release (fmlink.com article), but no licence text was found; buildingSMART Sample-Test-Files is CC BY 4.0 but no Duplex folder was confirmed there. (2) bim-open-schema/examples/*.bos (rac_basic_sample_project-2025, Technicalschoolcurrentm, Snowdon Towers Sample Architectural, BIM_Projekt_Golden_Nugget) derive from Autodesk sample projects; the repository's MIT licence covers Ara 3D's code, not Autodesk's content. The bim-open-data explorer bundles rac_basic_sample_project-2025.bos into its Pages build. Safe today: the synthetic BimSampleModel and samples/bim/sample.bos, which bim-open-flow will use. Decide: confirm terms with NIBS/ERDC, buildingSMART, and Autodesk, or replace the samples; add NOTICE files with attribution where kept.
