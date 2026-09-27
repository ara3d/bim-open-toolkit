# Ara3D.BimOpenSchema.Federation

Unions several BIM Open Schema documents into one, and writes that union as a
geometry-free BOS and a raw DuckDB database. Built for TKT-30, the Snowdon
federation: seven discipline IFC files unioned into one model, with matching
handled separately by a SQL graph (`samples/snowdon-analyses/federation-match.json`)
and federated views (`FederationStore`, `FederationViews`, added in C8).

## Layering

This is a data-group library, not code inside a CLI: four callers need it —
the `federate-union`/`federate-duckdb` tools verbs, the data tests here, the
flow tests that build the match graph over the union, and (later) TKT-31's
typed reader. It references `Ara3D.Ifc.Bos` (the converter) and
`Ara3D.BimOpenSchema.DuckDb` (the raw loader and views), so a caller needs no
other project reference to convert, union, and load a set of IFC files.

## `BosUnion`

- `ConvertIfc` runs `IfcToBosConverter` over each file in turn, disposing its
  `IfcFile` before moving to the next, so peak memory reflects one file
  rather than all of them.
- `Union` combines the converted documents with `BimDataBuilder.AddBimData`,
  one call per input, in input order. `AddBimData` never touches `Geometry`,
  so the union's `Geometry` is always null — federating geometry is future
  work (see the plan's extension points).
- `WriteBos` writes the union's non-geometry tables as a parquet zip that
  `ReadBimDataFromParquetZip` reads back.
- `WriteDuckDb` deletes any existing file at the output path, then loads the
  union with `BosDuckDb.LoadBimData` and adds `BosDuckDbViews.CreateViews`
  (`EntityText`, `ParameterText`, `RelationText`, `StoreyOfEntity`). Loading
  the BOS tables directly, rather than round-tripping through parquet, avoids
  the enum-shift the DuckDb README warns about for parquet-derived databases.
- `Summarize` reads each document's entity count and the `Ifc:LengthUnit` /
  `Ifc:LengthUnitToMetre` parameters on its `IFCPROJECT` entity, by name. It
  matches by string rather than referencing `Ara3D.Ifc.Bos`'s `IfcLengthUnit`
  constants, so it has no compile-time dependency on which parameter names
  land on that type versus the converter.

## `FederationExample`

A five-document union (Arch, Struct, Elec, Site, Plumb) that exercises every
outcome the match graph's rules can produce: matching storeys across
documents, a name mismatch, an elevation offset, a shared GlobalId across
unrelated storeys, a name collision between unrelated storeys, an unknown
length unit, matching grid axis tags, and matching an MEP space to a room by
room number (plus the "no room found" and "no room number" cases). It is
built directly with `BimDataBuilder`, not from an `.ifc` or `.bos` file,
because `.gitignore` ignores both extensions — a checked-in fixture was
[considered and rejected](../../../docs/plans/snowdon-federation-build.md)
for that reason.

`FederationExample` is the fixture used by this project's tests, by the flow
tests that build the match graph (C5, C6), by `FederationStore`'s tests (C8),
and by `--example` runs of the `federate-union`/`federate-duckdb` verbs (C4,
C9). Its exact contents — every storey's name, elevation, and GlobalId; every
space's category and Identity Data; every axis tag; every element's storey —
are documented in the plan's "FederationExample contents" table and must not
drift from it without updating every caller.
