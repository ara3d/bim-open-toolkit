# DataFlow Graph Format

**Part:** format | **Version:** 0.1.0 | **Status:** Draft

Defines the graph document: the JSON file that holds an analysis. The
user-facing name for the whole thing is an *analysis*; the technical name for
the structure it contains is a *graph*. The file extension is `.dfg.json`.

Normative words (MUST, MUST NOT, SHOULD, MAY) follow RFC 2119. JSON Schemas
live in `schemas/`; conformance vectors in `conformance/`. Where this document
and a schema disagree, this document wins and the schema has a bug.

## 1. Document shape

A graph document is one JSON object with exactly these members:

```jsonc
{
  "formatVersion": "0.1.0",
  "structure": { "nodes": [...], "edges": [...] },   // topology
  "values":    { "<nodeId>": { "<param>": ... } },   // parameter values
  "layout":    { "<nodeId>": { "x": 0, "y": 0 } },   // canvas placement
  "session":   { ... }                               // camera, display flags
}
```

- `formatVersion` — the version of this format part the document conforms to.
  Required.
- `structure` and `values` — required. Together they fully determine
  evaluation (see the semantics part).
- `layout` and `session` — optional. Stripping either or both MUST NOT change
  evaluation results or the graph hash (§6).
- No other top-level members are allowed. An unknown top-level member makes
  the document invalid. Forward compatibility is handled by version
  migration, not by tolerated extra layers.

## 2. Names and identifiers

- **Node id** — matches `[A-Za-z0-9_-]+`. No dot: the dot is the separator in
  edge endpoints. Unique within the document.
- **Kind id** — the node type, dotted, at least two segments, each segment
  matching `[A-Za-z][A-Za-z0-9]*`. Example: `source.model`,
  `select.byType`.
- **Kind version** — integer ≥ 1. A node references a kind as (kind id,
  version); the pair is the node's identity for evaluation and memoization.
- **Port name / parameter name** — matches `[A-Za-z][A-Za-z0-9]*`.
- **Edge endpoint** — the string `"<nodeId>.<portName>"`. Because node ids
  contain no dot, the split point is unambiguous.

## 3. The `structure` layer

```jsonc
"structure": {
  "nodes": [ { "id": "n1", "kind": "source.model", "version": 1 } ],
  "edges": [ { "from": "n1.out", "to": "n2.model" } ]
}
```

- `nodes` — array of `{ id, kind, version }`. No other members.
- `edges` — array of `{ from, to }` endpoints. `from` names an output port,
  `to` names an input port.
- Port sets are declared by the node catalog for each (kind, version), not by
  the document. Port existence and type compatibility are *catalog validity*
  (§5), checked when a catalog is available.

## 4. The `values`, `layout`, and `session` layers

**`values`** — object keyed by node id; each entry is an object keyed by
parameter name. **Every parameter value is a JSON string**: the canonical
string form of the value, invariant culture. Typed interpretation happens
against the catalog (catalog validity, §5); the document itself carries only
strings, which keeps the layer uniform, keeps Int64 exact (no JSON number
precision limits), and makes hashing trivial.

| Parameter kind | Canonical string form |
|---|---|
| Boolean | `"true"` / `"false"` |
| Integer | decimal, full Int64 range, no leading zeros, `-` only for negatives |
| Number | .NET round-trip ("R") format, invariant culture (§6 rule 5) |
| Text | the text itself |
| Enum | the option name (one of the catalog-declared options) |
| FilePath | the path text |
| ModelRef | the model reference text |
| Expression | source text per the expressions part |
| Json | the JSON text |
| DateTime | ISO-8601 (`yyyy-MM-dd` or `yyyy-MM-ddTHH:mm:ss`), no offset; empty = unset |

To unset a parameter, omit it; `null` is never a legal parameter value.

**`layout`** — object keyed by node id; each entry is
`{ "x": number, "y": number, "w"?: number, "h"?: number }`, all finite.

**`session`** — one object. Well-known members: `camera`
(`{ "x": number, "y": number, "zoom": number }`, the canvas viewport) and
`display` (array of node ids whose output is flagged for display). Additional
members are allowed in `session` only — it is the most volatile layer and
tools MUST preserve members they do not understand when round-tripping.

## 5. Validity

Two levels, checked in order.

**Document validity** — intrinsic, needs no catalog:

1. The document parses as JSON and matches `schemas/dfg.schema.json`.
2. Node ids are unique.
3. Every edge endpoint's node id names a node in `structure.nodes`.
4. At most one edge targets any given input port (`to` values are unique).
5. The edge graph is acyclic. A cycle makes the document invalid — there is
   no feedback or iteration construct in this format.
6. Every key of `values` and `layout` names a node in `structure.nodes`.
7. Node ids in `session.display` name nodes in `structure.nodes`.

**Catalog validity** — additionally, given a node catalog:

1. Every (kind, version) is known to the catalog.
2. Every edge endpoint names a port that exists on its node, with the correct
   direction (`from` an output, `to` an input).
3. Edge value kinds are compatible if and only if the output port's type is
   `Any`, or the input port's type is `Any`, or the input port's type is
   exactly the output port's kind. There is no conversion at an edge —
   Integer → Number widening is deliberately deferred (the expression
   language widens internally; edges do not).
4. Every parameter name in `values` is declared by the node's kind, and its
   string parses as the declared parameter kind's canonical form (§4).

A tool that has no catalog MUST still enforce document validity.

## 6. Canonical serialization and identity

Writers MUST emit the canonical form. Readers MUST accept any document that
is valid per §5, canonical or not; loading and re-saving canonicalizes.
`save(load(x)) = x` byte-for-byte whenever `x` is canonical.

Canonical form:

1. **Encoding and layers** — UTF-8, no BOM. Line separator is LF. The
   document text ends with exactly one LF. Empty optional layers are
   omitted: a canonical document never contains `"layout": {}` or
   `"session": {}`. `formatVersion` is always written.
2. **Layout** — pretty-printed: every object member and array element on its
   own line; indentation two spaces per nesting level; `": "` between key and
   value; no trailing whitespace. Empty objects and arrays are `{}` and `[]`
   on one line.
3. **Key order** — all object keys sorted ascending by Unicode code point.
   This applies to every object, including the top level.
4. **Array order** — `structure.nodes` sorted ascending by `id`;
   `structure.edges` sorted ascending by `to` (unique in a valid document,
   see §5 rule 4). All other arrays keep author order (order is meaningful,
   e.g. `session.display`).
5. **Numbers** — integers: no decimal point, no exponent, no leading zeros,
   `-` only for negatives. Non-integers: the .NET round-trip ("R") format,
   invariant culture — the shortest string that parses back to the same
   double, with an uppercase-`E` signed exponent where used (e.g. `0.1`,
   `1E+21`). Negative zero canonicalizes to `0`. NaN and infinities cannot
   occur (not JSON). This same form is the canonical string form for
   Number-kind parameter values (§4).
   `// TODO: a non-.NET implementation must reproduce .NET "R" output`
   `// byte-for-byte; document the exact algorithm (or a vector corpus)`
   `// before a second implementation starts.`
6. **Strings** — minimal escaping: only `"` (as `\"`), `\` (as `\\`), and
   control characters U+0000–U+001F (as `\b`, `\t`, `\n`, `\f`, `\r` where
   defined, otherwise `\u00XX` with lowercase hex). All other characters
   appear literally as UTF-8.

**Graph hash.** The document's identity is

```
graphHash = lowercase-hex(SHA-256(UTF-8 canonical text of {"structure": S, "values": V}))
```

64 lowercase hex characters, no prefix. The hashed object holds only the
`structure` and `values` layers, serialized by the same canonical rules (its
two keys sort as `structure`, `values`) — except that the hash input has
**no trailing LF** (the trailing LF of rule 1 is a property of the document
file, not of the hash input). `formatVersion`, `layout`, and `session` are
excluded: editing the canvas or the camera never changes graph identity, and
two documents with equal graph hashes are the same analysis.

## 7. Schemas

- `schemas/dfg.schema.json` — the whole document (references the rest).
- `schemas/structure.schema.json`
- `schemas/values.schema.json`
- `schemas/layout.schema.json`
- `schemas/session.schema.json`

Schemas express shape only. Cross-cutting rules (§5 rules 2–7, acyclicity)
are stated here and tested by the conformance vectors; JSON Schema cannot
express them.

## 8. Conformance vectors

`conformance/` holds numbered cases; see `conformance/README.md` in this
directory tree's root README for the vector file format. This part ships
vectors for: minimal valid document, unknown top-level layer, duplicate node
id, dangling edge, duplicate input edge, node id containing a dot, cycle, and
layout/session-stripped hash equivalence.

## 9. Versioning

This part is versioned independently (semver). A breaking change to canonical
serialization or to the hashed subset changes every graph hash; the migration
notes for any such release MUST say so and MUST ship a mechanical migration
in `Ara3D.NodeGraph.Migrations`.
