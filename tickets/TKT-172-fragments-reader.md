---
id: TKT-172
title: Read That Open Fragments 2 (.frag) files into BOS
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Fragments/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/**]
workflow: [W1]
created: 2026-10-10
closed: 2026-10-10
---

## Acceptance criteria

- [x] A library call reads a Fragments 2 file (FlatBuffers root Model, file identifier 0001, schema from ThatOpen/engine_fragment packages/fragments/flatbuffers/index.fbs pinned to a commit) into a BOS document: entities, parameters, relations, and geometry
- [x] Shells (polygon profiles with holes) are triangulated and circle extrusions tessellated; the result is z-up BOS geometry in metres
- [x] Attribute values keep their type where the file states it; a missing value stays missing, never 0 or an empty string
- [x] A committed fixture made from a public model (the Duplex, CC BY 4.0) round-trips: element count, GlobalIds, and storey containment match the BOS made from the same IFC by Ara3D.Ifc.Bos, and the triangle count is reported
- [x] An unsupported version or identifier fails with a message that names it

Fragments is That Open's binary format for web BIM viewers. Reading it lets someone with a .frag from a That Open app query it with Claude over DuckDB (workflow 1). A writer is out of scope here. The MCP tool, solution entry, and README line are supervisor integration. Format survey: chat 2026-10-08.

Done 2026-10-10 in ara3d/bim-open-data: `00deae9` (entities, properties, relations), `99e5b31` (geometry), MCP tools `frag_to_bos` and `bos_sql` in `8db3659` and `0e92cb9`. Entities with no GlobalId or Name still get "" because BimDataBuilder cannot write absent (TKT-175).
