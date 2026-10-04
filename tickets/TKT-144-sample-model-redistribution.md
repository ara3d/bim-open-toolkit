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

## Notes

- 2026-10-03, owner's decision: public demos use two openly licensed buildings.
  - **Schependomlaan**, `github.com/openBIMstandards/Archive-DataSetSchependomlaan` (archived; current home buildingSMART `Sample-Test-Files`, IFC 2x3), CC BY 4.0, "(C) original owners". The design model is a 10-apartment Archicad export: IFC2X3, 49 MB, 6 storeys, 100 spaces, 205 doors, 259 windows, 934 walls, rich quantity sets, 1,675 second-level space boundaries. It also has subcontractor models (steel, precast floors, railings, utilities) and weekly as-planned models.
  - **DigitalHub**, `github.com/RWTH-E3D/DigitalHub`, MIT, (c) 2020 RWTH Aachen University E3D. Version 2 is IFC4 Reference View from Revit (2023-10). Architecture: 64 spaces, 64 doors, 47 windows. Heating: 42 systems, 914 pipe segments, 743 fittings, 63 space heaters, 1,873 port connections. Ventilation and plumbing models too, plus a version 1 with space boundaries.
- Each repository that ships a converted copy carries a NOTICE with the attribution and the statement that the files were converted to BIM Open Schema tables.
- Still open: the Duplex (NRC work) and the Autodesk-derived `bim-open-schema/examples`. Public demos stop depending on them.
- 2026-10-03, Duplex resolved: buildingSMART International republished the Duplex Apartment files in `github.com/buildingsmart-community/Community-Sample-Test-Files` (`IFC 2.3.0.1 (IFC 2x3)/Duplex Apartment`, includes `Duplex_A_20110907.ifc`), whose LICENSE reads "(C) original authors. This work is licensed under the Creative Commons Attribution 4.0 International License." Attribution, as the ifc-bench dataset gives it: "BSI (2020) Duplex Apartment Test Files, buildingSMART International". The Duplex may be redistributed with that attribution; repositories that ship it need a NOTICE. Only the Autodesk-derived `bim-open-schema/examples` remain open.
- Other openly licensed models found the same day through `huggingface.co/datasets/sylvainHellin/ifc-bench` (each project has its own `license.txt`): CC BY 4.0: KIT's AC20, FZK house and Smiley West; buildingSMART's Medical-Dental clinic, WBDG office, Molio, Sixty5; Schependomlaan. MIT: DigitalHub; TUM student buildings (2 hotels, 3 offices, 1 residential). Avoid for MIT repositories: the BIMserver.org models (4351, Ettenheim, Hitos, Samuel Macalister; GPL v3) and West Riverside Hospital (no clear licence).
