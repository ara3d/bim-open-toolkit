---
id: TKT-221
title: Which basemap, and which georeference when a model has no IfcMapConversion?
status: open
depends_on: []
owner:
fence: [deps/bim-open-plot/]
created: 2026-10-11
kind: question
---

Serves bim-open-plot workflow 2 (deps/bim-open-plot/PROJECT.md): place the model on a public basemap. Open points: which tile provider the public demo page uses (OpenStreetMap raster, a vector style, or none and a plain GeoJSON background), its terms of use for a GitHub Pages site, and what the map view does when the IFC carries no IfcMapConversion or IfcSite latitude/longitude (the Duplex and FZK-Haus cases). Default: OpenStreetMap raster tiles with attribution, and a stated origin parameter on the map view that a demo sets by hand, marked as assumed on the page.
