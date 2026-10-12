# BimOpenFlow.Nodes.Ids

The `ids.*` pack: buildingSMART IDS 1.0 (Information Delivery Specification)
files as checks in a graph. The evaluator is `Ara3D.Ids` in bim-open-data; this
pack only wires it to tables and parameters.

| Node | Inputs | Outputs | Parameters |
|---|---|---|---|
| `ids.check` | `entities`, `parameters` (the first two outputs of `bos.load`); `relations` (its third output, optional) | `verdicts`, `summary` | `ids` (the `.ids` file) |
| `ids.specifications` | none | `specifications` | `ids` |

`verdicts` carries the issue-table columns (TKT-182): `GlobalId`, `EntityIndex`,
`CheckId`, `CheckTitle`, `Citation`, `Verdict` (Pass, Fail, InfoNotAvailable),
`Reason`. It feeds `view3d.color`, `table.aggregate`, `chart.bar`, `report.html`
and `bcf.write` the same way a `check.rule` table does. `summary` has one row
per specification with its Pass, Fail and InfoNotAvailable counts.

Facets evaluated: entity (class and predefined type), property (set, name,
value, data type at the number, logical, or text level), attribute, and, when
`relations` is wired, material and part-of. Classification and document facets,
and material and part-of without `relations`, give InfoNotAvailable with a
warning on the node. IDS values are in SI units and the model's numbers are
converted before comparing; Ara3D.Ids's README in bim-open-data says how each
facet reads the model.
