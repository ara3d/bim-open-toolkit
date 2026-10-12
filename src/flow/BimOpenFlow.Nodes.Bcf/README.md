# BimOpenFlow.Nodes.Bcf

The `bcf.*` pack: BCF 3.0 (BIM Collaboration Format, buildingSMART's issue
exchange format) in and out of a graph. The writer and reader are
`Ara3D.BimOpenSchema.IO.Bcf` in bim-open-data; this pack wires them to tables.

| Node | Kind | Inputs | Outputs | Parameters |
|---|---|---|---|---|
| `bcf.topics` | pure | `issues` | `topics` | `preset`, `verdicts` |
| `bcf.write` | effect | `issues` | `out` (summary) | `path`, `model`, `preset`, `verdicts`, `author`, `guidSeed` |
| `bcf.read` | pure | none | `issues`, `topics` | `path` |

The input of `bcf.topics` and `bcf.write` is any table with a `GlobalId`
column and a title column: an issue table (`Title`, optional `Description`,
`Status`, `Priority`, `Type`) or a verdict table (`CheckTitle`, `Citation`,
`Verdict`) from `check.rule` or `ids.check`. `preset` says which (`auto` picks
by the columns present), and when a `Verdict` column exists only the verdicts
listed in `verdicts` are kept (default `Fail`; empty keeps all). Rows sharing a
title become one topic. Column names match case-insensitively, so the
compliance pack's camelCase columns work too.

`bcf.write` stays pending until Run (nothing writes until Run). With `model`
pointing at the `.bos` file, each topic's viewpoint selects its elements under
a camera that frames them; without geometry the GlobalIds go in the topic's
description, because BCF 3.0 requires a camera in every viewpoint. The summary
row names the file with its byte count and SHA-256.

`bcf.topics` is the preview: the same grouping as `bcf.write`, as a table on the
canvas. Its `GlobalIds` column lists the ids in IFC's 22-character form and
`AuthoringToolIds` the rest, the way `bcf.write` will emit them; `Elements`
counts both. `bcf.read` brings a BCF back as an issues table that joins to a model on
`GlobalId`. A component the BCF names only by `AuthoringToolId` (a Revit
UniqueId, say) gets its own row with the id in an `AuthoringToolId` column and
an empty `GlobalId`, so the two kinds of id never mix; its `topics` output
splits them the same way. `bcf.topics` and `bcf.write` take a row's
`AuthoringToolId` when its `GlobalId` is empty, so a BCF read and written again
keeps every component. A viewpoint or markup
that is not XML, or a viewpoint the markup lists but the file lacks, is skipped
with a warning naming the entry; the other topics still come through.
