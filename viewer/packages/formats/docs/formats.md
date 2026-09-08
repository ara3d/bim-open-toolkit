# Supported formats

Every format in this table becomes the same `LoadedModel`: object records with identity, a columnar
`Geometry`, one `CoordinateContext`, and diagnostics. What differs is how much each format can say.

## The table

| Format | Default | Objects | Names | Categories | Source ids | Hierarchy | Per-placement colour | Instancing | Units stated |
|---|---|---|---|---|---|---|---|---|---|
| `bfast` | yes | every entity row | yes, at `metadata: 'full'` | yes, at `metadata: 'full'` | yes | no | yes | yes | no |
| `bos` | through BFAST | as BFAST | as BFAST | as BFAST | as BFAST | no | yes | yes | no |
| `glb` | no | every node | yes, when the node has one | no | no | yes, `parentId` | material base colour | yes | yes |
| `gltf` | no | as GLB | as GLB | no | no | as GLB | as GLB | yes | yes |
| `obj` | no | one per `o` or `g` group | yes, the group name | no | no | no | no, opaque white | no | no |
| `stl` | no | one | the header or `solid` name | no | no | no | no, opaque white | no | no |

BFAST is the default model format across V2 (user decision, 2026-09-07). BOS is not read again: it is
prepared as BFAST with the loaders' own `bosToBfast` and then takes the BFAST path, so the two cannot
drift apart. Loading a BOS and loading its prepared bytes give the same `data` and `geometry`; only
`format` and `sourceBytes` differ, and those describe what the caller supplied.

## How each format carries its meshes

`Geometry` has two ways to hold the same meshes: `meshes`, a record per mesh, and `meshTable`, the
buffers those records would view. A reader takes the table when there is one and the list otherwise,
which `meshAt` and `geometryBounds` in the model package already do.

| Format | `meshes` | `meshTable` | Why |
|---|---|---|---|
| `bfast`, `bos` | empty | yes | The file is already one vertex buffer, one index buffer and a range per mesh, with indices local to their mesh. The table is those buffers plus four integer columns, so no mesh record and no vertex copy exists on the load path. |
| `glb`, `gltf`, `obj`, `stl` | yes | no | Each parser builds a separate buffer per mesh, so a table would be a second copy of every vertex for no reader that has asked for one. `meshTableFrom` makes one from the list when a caller wants it. |

## What each format carries, and what is lost

### BFAST (`.bfast`, `.vim`)

Carries prepared triangle geometry as typed-array views on the file, 64-byte instance records, and,
in a combined file, every original BOS Parquet table byte for byte.

- **Geometry** is a `meshTable` whose position and index buffers are the file's own, whose four range
  columns are the file's mesh slices, and whose bounds column is the file's stored per-mesh boxes.
  `Geometry.meshes` is empty. Boxes are copied, with the unusable ones emptied, only when the file
  holds one that is not finite or belongs to a mesh with no vertices.

- **Objects** are the rows of the embedded `Entities` table when the file has one, so an entity that
  no placement draws is still an object. Without that table, objects are the entities the instance
  records name. An instance naming an entity beyond a declared table is an error, not a new object.
- **Names and categories** come from `Entities` at `metadata: 'full'`, the default. BOS stores both
  as indices: `Name` indexes the string table, and `Category` names another entity row whose own name
  is the label. An index that is absent, negative, out of range or names a blank string reads as no
  value. `metadata: 'identity'` decodes source ids only; `metadata: 'none'` reads no tables at all.
- **Source ids** are the `LocalId` column, which is the id the source document (usually IFC) used.
- **Hidden placements** are rows like any other, with `visible` 0, so a host can show one or unhide it
  with a column write and nothing is rebuilt. The `visible` column exists only when the file marks
  something hidden, and the count is reported as `formats/hidden-instances`. `ObjectRecord.representation`
  names the object's first placement with geometry whether or not it is hidden, because hiding is a
  state a host changes and the representation is not.
- **Roughness and metallic** are the two high bytes of the flags word, one value per placement, and
  become the `roughness` and `metallic` instance columns. Each column exists only when some placement
  differs from the contract's default, since an absent column reads as that default: fully diffuse
  and not metal.
- **Lost: hierarchy.** BOS records relations in a separate table this adapter does not read.
- **Assumed: coordinates.** BFAST records neither units nor an up axis. The model is reported as Z up
  with unknown units, with a `formats/assumed-coordinates` note, because the models this path is for
  come out of Revit and IFC. Nothing is rotated at load; state your own `coordinates` to override.
- Lines, quads and vertex colours are refused. This path reads triangle models only.

### BOS (`.bos`)

A ZIP of Parquet tables. Everything above applies, after preparation. Preparation is the expensive
half of the load: on the reference model it is about twice the cost of everything else together.

### glTF (`.gltf`) and GLB (`.glb`)

- **Objects** are nodes, all of them, so a named group node that draws nothing stays addressable and
  its children point at it through `parentId`.
- **Instances** are one row per drawn primitive of each node, with the node's world transform baked
  in and the material's `baseColorFactor` as the colour factor.
- **Units** are the one thing glTF states: metres, Y up, right-handed. No assumption is made.
- Accessors are read with byte strides, normalized integer scaling and sparse substitution.
- **Lost: textures, animation, skinning and morph targets.** Reported as
  `formats/dropped-textures` and `formats/dropped-animation`.
- **Lost: non-triangle primitives.** Reported per primitive as `formats/dropped-primitives`.
- **Refused: any required extension**, named in the message. Draco and meshopt compression are the
  two that matter; a document that needs one fails rather than loading partly.
- A `.gltf` that names a file it does not contain needs a `Resolver`. Without one the load fails
  naming the uri; nothing is fetched because a document asked for it.

### OBJ (`.obj`)

- **Objects** are `o` and `g` groups, one mesh and one placement each, keeping the group name. A file
  with no group statement is one object.
- Positions and normals are indexed separately by the format, so each distinct pair becomes one
  vertex of the built mesh. Texture coordinates are parsed and discarded.
- Faces with more than three corners are triangulated as a fan. That is right for the convex faces
  exporters write and wrong for a concave one, and the format does not say which it is.
- **Lost: materials.** `mtllib` and `usemtl` are noticed and reported as
  `formats/dropped-material-library`; every placement is opaque white.
- **Assumed: coordinates.** Y up, unknown units.

### STL (`.stl`)

- Binary and ASCII, told apart by whether the file's length is exactly what its declared triangle
  count needs. One object, one mesh, one placement.
- The object's name is the binary header, or the word after `solid`.
- Three vertices per triangle, each carrying the facet's own normal. STL shares no vertices, and
  welding them is a mesh operation rather than a format one.
- **Lost: colour.** Some writers put colour in the attribute word, and nothing in the file says which
  convention. Reported as `formats/dropped-vertex-colors`.
- **Assumed: coordinates.** Z up, unknown units.

## Detection

`detectFormat` reads the byte signature first, because a name can be wrong, and falls back to the
name only when the bytes carry no signature. The returned note says which of the two answered.

| Format | Signature |
|---|---|
| `bfast` | `0xbfa5` then a zero word, little-endian |
| `bos` | the ZIP local file header `PK\x03\x04` |
| `glb` | `glTF` as a little-endian word |
| `stl` | length exactly `84 + count * 50`, else a first word of `solid` |
| `gltf` | JSON whose first object has an `asset` member |
| `obj` | a line starting with a statement keyword and an argument |

Any ZIP is read as a BOS. A file that is not one fails during preparation with a message that says so.

## Coordinates

No adapter rotates anything. Each model reports the frame it is in, and a renderer converts with the
model package's `contextTransform`. Where a format states nothing, the adapter reports the convention
its tools use, marks it with a `formats/assumed-coordinates` note, and takes `options.coordinates`
over its own guess. This is what F22 maps and any measurement will need.

## Diagnostics

Every failure and every loss has a code. They divide into three kinds:

- **Failures** (`formats/invalid-bfast`, `-bos`, `-gltf`, `-obj`, `-stl`, `formats/unknown-format`,
  `formats/empty-source`, `formats/fetch-failed`, `formats/unresolved-resource`,
  `formats/cancelled`, `formats/invalid-model`, `formats/load-failed`). `loadModel` returns these;
  it never raises.
- **Losses**, at warning severity: `formats/dropped-textures`, `-animation`, `-primitives`,
  `-material-library`, `-vertex-colors`, plus `formats/missing-entity-table` and
  `formats/no-geometry`.
- **Decisions and observations**, at info severity: `formats/detected-format`,
  `formats/assumed-coordinates` and `formats/hidden-instances`.

A diagnostic carries a path into the value it is about, so a message can point at mesh 12's index 7
rather than at the file.
