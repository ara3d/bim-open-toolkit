# BimOpenFlow.Nodes.Bcf

The `bcf.*` pack: BCF 3.0 (BIM Collaboration Format, buildingSMART's issue
exchange format) in and out of a graph. The writer and reader are
`Ara3D.BimOpenSchema.IO.Bcf` in bim-open-data; this pack wires them to tables.

| Node | Kind | Inputs | Outputs | Parameters |
|---|---|---|---|---|
| `bcf.issue` | pure | `camera` (optional) | `issues` | `title`, `description`, `comment`, `author`, `created`, `status`, `priority`, `type`, `ids` |
| `bcf.topics` | pure | `issues` | `topics` | `preset`, `verdicts` |
| `bcf.write` | effect | `issues` | `out` (summary) | `path`, `model`, `preset`, `verdicts`, `author`, `guidSeed`, `created`, `modelDate` |
| `bcf.read` | pure | none | `issues`, `topics`, `comments` | `path` |

The input of `bcf.topics` and `bcf.write` is any table with a `GlobalId`
column and a title column: an issue table (`Title`, optional `Description`,
`Status`, `Priority`, `Type`) or a verdict table (`CheckTitle`, `Citation`,
`Verdict`) from `check.rule` or `ids.check`. `preset` says which (`auto` picks
by the columns present), and when a `Verdict` column exists only the verdicts
listed in `verdicts` are kept (default `Fail`; empty keeps all). Rows sharing a
title become one topic. Column names match case-insensitively, so the
compliance pack's camelCase columns work too.

`bcf.issue` makes the issue table by hand or from the 3D pane: its "Comment" button adds a
`view3d.camera` holding the current camera and a `bcf.issue` holding the title, comment, author,
selected GlobalIds (`ids`) and creation time (`created`, UTC `yyyy-MM-ddTHH:mm:ssZ`; the node reads no
clock). It gives one row per distinct id, or one row with an empty `GlobalId` when there are none
(a comment on the whole model), the columns `GlobalId, Title, Description, Status, Priority, Type,
Comment, CommentAuthor, CommentDate, Author, CreationDate`, and with a camera wired in also `CameraX..Z, DirectionX..Z, UpX..Z,
FieldOfView, AspectRatio` (direction is target minus position, normalised; up is z made perpendicular
to it; aspect 1). `CommentAuthor` and `CommentDate` hold the same values as `Author` and `CreationDate`: those two describe the topic, the others its comment. A blank `title` is an error. Wire it into `bcf.topics` to preview and `bcf.write`
to write.

`bcf.write` stays pending until Run (nothing writes until Run). With `model`
pointing at the `.bos` file, each topic's viewpoint selects its elements under
a camera that frames them; without geometry the GlobalIds go in the topic's
description, because BCF 3.0 requires a camera in every viewpoint. The summary
row names the file with its byte count and SHA-256.

With `model` set, `bcf.write` also names the model file in the BCF header (file name and the path as
given), plus a `Date` only when `modelDate` is set (UTC `yyyy-MM-ddTHH:mm:ssZ`; a file's
last-write time changes with every checkout, so it is never read). `created` (same format) fixes
every topic's creation date and the zip timestamps; left empty it is the time of the Run, so two
Runs give different bytes. Set it and the BCF is byte-identical on every rerun. A value in
another form is an error naming the parameter. A camera in the input (`CameraX..AspectRatio`, as
`bcf.issue` makes them) becomes the topic's viewpoint camera in place of the framed one, and a
`Comment` column becomes the topic's comments (author and date from the row's `CommentAuthor` and
`CommentDate`). `bcf.read` returns the same columns: the `issues` output carries the camera
columns (empty for a topic without a viewpoint camera) and a `Comments` count, and the `comments`
output has one row per comment: `TopicGuid, Title, CommentAuthor, CommentDate, Comment`.

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
