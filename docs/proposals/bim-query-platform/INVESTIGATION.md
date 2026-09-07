# Initial evidence for the redesign

Read-only inspection on 2026-09-06. No new BOS-to-BFAST conversion or loading benchmark was run
for this planning investigation. Counts below are distinguished from tentative cache observations.

## 1. Input scope

Recursive inventory was limited to the two user-supplied locations; it was not a whole-disk scan.

| Directory | BOS files | Total bytes |
|---|---:|---:|
| `C:/data/nxt-bld` root | 3 | 764,097,320 |
| `C:/data/nxt-bld/gni-bos-v0` | 224 | 187,081,123 |
| `C:/data/nxt-bld/gni-bos-v1` | 224 | 194,038,118 |
| `C:/Users/cdigg/Documents/BIM Open Schema` root | 15 | 143,189,445 |
| Its `generated` child | 1 | 7,898,891 |
| **Total** | **467** | **1,296,304,897** |

The three root stress-collection files are `all-max-compress.bos`, `all-medium.bos` and
`nmi-ifc-all.bos`. No content deduplication has yet been verified. Every path must remain in the
conversion inventory even if identical contents later share a cache.

The user clarified that IFC-to-BOS conversion is incomplete and some files may be imperfect.
The Documents corpus is generally Revit-derived and more reliable. Use that corpus to investigate
rich semantic examples and the IFC collection for scale/federation/incomplete-data behavior.
Neither filename nor exporter family alone establishes correctness of every fact.

## 2. Facts read directly from all-medium.bos

The file is **ZIP/Parquet**, established by its header, and is 425,674,752 bytes long. Bounded direct
reads of the Parquet footers in its uncompressed ZIP core entries established these row counts:

| Table | Rows |
|---|---:|
| Entities | 1,237,191 |
| Parameters | 2,918,524 |
| Descriptors | 42,033 |
| Documents | 224 |
| Strings | 1,015,215 |
| Numbers | 33,617 |
| Relations | 0 |
| Points | 0 |
| Diagnostics | 0 |

Each of these core tables has one row group. No manifest ZIP entry was found. Geometry entries
exist: `VertexBuffer.parquet` has an uncompressed entry length of 780,834,801 bytes and
`IndexBuffer.parquet` 401,993,624 bytes. Geometry entries were not decompressed during this inspection.

Important limits on interpretation:

- 224 documents does not establish 224 buildings or identical document/building boundaries.
- 1.24 million source entities does not establish 1.24 million physical components.
- Zero explicit relationships does not establish disconnected systems or absent containment.
  Information may be encoded elsewhere, or it may not have been exported.
- Zero diagnostics does not establish a correct or complete model.

## 3. Nearby BFAST evidence — correspondence remains unverified

| File in `C:/data/nxt-bld` | Bytes | What was established |
|---|---:|---|
| `bimdata.bfast` | 106,335,552 | Fixed-width core buffer counts match stress-file counts; content equality is unverified |
| `all-bim-data.bfast` | 122,452,224 | Different counts and nonempty relationships; cannot be assumed to be this dataset |
| `all.bfast` | 1,571,533,248 | Render-oriented buffers; not a complete semantic BOS cache |

Under the existing render layout, header lengths in `all.bfast` imply 85,170,758 vertices,
107,166,750 indices, 414,992 meshes and 1,184,284 instances. These are observations about that
render file, **not verified geometry counts for all-medium.bos**.

Bounded samples from `bimdata.bfast` include document titles `model_0`, `model_0_arc` and
`model_0_structure`; stored paths reference a former `gni-bos` directory. Sample descriptor names
include `IsExternal` and `LoadBearing` under `Pset_WallCommon` (stored as string kind), `FireRating`
under `Pset_WindowCommon`, and an environmental-impact property group. Initial entity examples
include IFC project/building/unit classes and local IDs of `-1`.

These are useful hypotheses for the data atlas. They must not be presented as verified source
examples until cache/source correspondence has been established. In particular, inspect whether
string-valued flags can be interpreted consistently and which entity roles are countable occurrences.

## 4. Why the existing reading path needs replacement

The existing [BosBfastSerializer](../../../src/Ara3D.BimOpenSchema.IO/BosBfastSerializer.cs):

- Serializes core tables but omits geometry and the manifest.
- Maps buffers and then copies them into managed arrays; it decodes all strings.
- Casts a view's byte size to `int`, constraining individual buffers.
- Relies on unmanaged struct layout and ordinal buffer positions.
- Packs the string table during sizing and again while writing.

These are reasons to design a complete versioned cache/access boundary locally, not to assume
that changing the input extension solves loading and memory consumption.

The previous prototype's [BosReader](../../../src/Ara3D.BimOpenSchema.DataModel.IO/BosReader.cs)
copies whole Parquet ZIP entries into memory, retains decoded arrays, and constructs expanded
records. Its correctness fixtures remain useful, but it should not be the conservative-memory
cache-builder design by default.

The SDK exposes range/view facilities, but convenience readers can copy buffers, and callback
views may be disposed at callback completion. The implementation phase must verify ownership,
actual copies, schema compatibility and lifetime before returning any borrowed memory.

## 5. Questions the fast investigation should answer

1. Which rows represent real occurrences, definitions, metadata, relationships and representations?
2. How do documents map to IFC sources, sites, buildings, storeys, spaces and source revisions?
3. Which containment, material and connection facts survived conversion, and where are they encoded?
4. Which common quantities, materials and classifications are present, derivable, conflicting or missing?
5. Which numeric/boolean/unit encodings require source-specific interpretation?
6. What coordinate frames, offsets and geometry representations exist, and which alignments are known?
7. What actually differs between the v0/v1 collections, and can identities be reconciled reliably?
8. Which gaps arise in the authoring data, which in IFC-to-BOS conversion, and which in our mappings?

The next implementation milestone is the verified BFAST cache and bounded query path described
in [PLAN.md](PLAN.md), followed by an evidence-backed atlas. Ten-second loading and the 16 GiB
ceiling are acceptance requirements, not results claimed by this inspection.
