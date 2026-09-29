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

## `FederationStore` and `FederationViews`

`FederationStore.Build` writes the studio database: a copy of a typed export
(or an empty database, when none is given) plus a DuckDB schema `federation`
holding the facts a federated query needs and the views that read them.
Nothing outside that schema changes, so the nine typed studio graphs keep
reading `main` untouched while three new graphs read `federation.*` (plan
Design item 6).

Build attaches the union database read-only as `u` and copies out of it:

- `federation.source_entity` — every real union entity (its STEP id is not
  negative, which excludes only the type/category placeholder entities
  `BimDataBuilder` adds for `Entities.Category` — those never carry a
  GlobalId and are not BIM objects), its document title, its GlobalId (empty
  for entities that carry none, such as grid axes), and its `Other`/`Category`
  parameter (`revit_category`) when it has one. Filtering on the STEP id
  rather than requiring a non-empty GlobalId keeps elements that convert with
  no GlobalId (`FederationExample`'s door, beam, and light fixture) visible
  to `FederatedStoreyOfEntity`, matching the plan's worked example.
- `federation.source_storey_of_entity` — one row per entity, the nearest
  `IFCBUILDINGSTOREY` ancestor from `u.StoreyOfEntity`, keeping the row with
  the minimum depth, then the minimum storey index.
- `federation.correspondence` — the correspondence Parquet, copied in as is.
- `federation.provenance` — the caller-supplied `(key, value)` pairs (build
  inputs' hashes, timestamps, and similar facts C9's `federate-duckdb` needs
  to record).

Some DuckDB builds cannot resolve `u.StoreyOfEntity`'s recursive CTE through
an attached alias. When that query fails, `FederationStore` detaches `u`,
opens a second, direct connection to the union database, runs the same
query there, and writes the rows in — the fallback the plan names for C8.

`FederationViews` holds the three views' SQL as strings, so the merge rule
has one location:

- `StoreyMembership` decides which source storeys merge into a federated
  group: a row merges when its status is Confirmed, or Candidate with no
  conflicts. A merged row keeps its group's `canonical_key` and
  `canonical_name`; any other row becomes its own row, keyed
  `canonical_key || '#' || source_document`, with `row_status` `Conflict`
  when its status is Candidate, otherwise the status itself.
- `FederatedStorey` groups `StoreyMembership` by federated key: a merged
  group's status is Confirmed only when every member is Confirmed, otherwise
  Candidate; a standalone row keeps its own status. `elevation_m` is the
  group's median.
- `FederatedStoreyOfEntity` joins `source_entity`, `source_storey_of_entity`,
  and `StoreyMembership` to give every entity's federated storey — neither
  view recomputes the merge rule.

Both `FederatedStorey` and `StoreyMembership` are exercised in
`FederationStoreTests` against a correspondence Parquet built by hand from
the plan's storey-rule worked example (12 rows over `FederationExample`):
9 `FederatedStorey` rows, 8 once Struct's `L1_Low` is Confirmed (at which
point the `L1` row gains a second document), the Arch `IFCDOOR` mapping to
`storey/0mm`, and the Elec `IFCLIGHTFIXTURE` mapping to `storey/0mm#Elec`
with status `Conflict`.
