# Notice for the Duplex Apartment files

The code in this repository is MIT licensed (`LICENSE` at the root). The Duplex building data in this folder keeps its own licence.

- Source: BSI (2020) Duplex Apartment Test Files, buildingSMART International, https://github.com/buildingsmart-community/Community-Sample-Test-Files, folder "IFC 2.3.0.1 (IFC 2x3)/Duplex Apartment", file `Duplex_A_20110907.ifc`.
- Licence: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/

Files derived from it:

- `duplex-base.ifc`: byte-identical to `Duplex_A_20110907.ifc`.
- `duplex-enriched.ifc`: the same model plus property sets written by the toolkit's enrichment graphs (`samples/nrc-analyses/nrc-enrich-run`).
- `duplex-*.bos` and `duplex-*.duckdb`: conversions of those IFC files to BIM Open Schema tables.

Attribution:

> BSI (2020) Duplex Apartment Test Files, buildingSMART International, licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; enriched with property sets and converted to BIM Open Schema tables by Ara 3D.
