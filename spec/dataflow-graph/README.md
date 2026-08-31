# DataFlow Graph Specification

The normative definition of BimOpenFlow's dataflow graphs: what a graph
document is, how it evaluates, what its expressions mean, and how an
evaluation is frozen into evidence. The user-facing noun for the whole thing
is an **analysis**; the technical noun is a **graph**; graph files are
`.dfg.json`, run records are `.run.json`.

## The four parts

Each part is its own directory with its own version, schemas, and
conformance vectors, so a spec+implementation pair can evolve without
touching the others.

| Part | Version | Defines | Implemented by |
|---|---|---|---|
| [format](format/format.md) | 0.1.0 | The graph document: four layers (`structure`, `values`, `layout`, `session`), canonical JSON serialization, the graph hash. | `Ara3D.NodeGraph` |
| [semantics](semantics/semantics.md) | 0.1.0 | Evaluation: determinism, value kinds and hashing, memoization, dirty propagation, standing sessions, Pure/Effect gating. | `Ara3D.DataFlowEngine` |
| [expressions](expressions/expressions.md) | 0.1.0 | The expression language for derive/filter/what-if nodes: grammar, precedence, static typing, null propagation, builtins. | `Ara3D.DataFlowEngine.Expressions` |
| [runs](runs/runs.md) | 0.1.0 | The run record: frozen evaluation (graph hash + input hashes + output hashes + outputs + timestamp), replay. Signing is a v0.x placeholder. | `Ara3D.DataFlowEngine.Runs` |

Reading order for newcomers: format → semantics → expressions → runs. The
one-sentence model: `structure + values` are a pure function from hashed
inputs to values; `layout + session` are strippable presentation; nothing
changes the world except an explicit Run; a Run freezes into a replayable
record.

## Authority rule

**This spec is normative. The C# engine is the canonical implementation,
proven canonical by the conformance suite** (`tests/Ara3D.DataFlowEngine.Conformance`
runs every vector here). Any other implementation — a TS preview evaluator,
anything — passes the same vectors or is wrong. When engine and spec
disagree, one of them has a bug and the fix lands in both in the same
change; silently diverging is not an option.

## Conformance vectors

Each part's `conformance/` directory holds numbered cases,
`NNN-name.json`, shaped:

```jsonc
{
  "part": "...", "case": "NNN-name", "description": "...",
  "input":  { ... },   // document, expression+environment, record, and/or steps
  "expect": { ... }    // valid/invalid + reason, values, hashes, counts, outcomes
}
```

Steps (`evaluate`, `setValue`, `run`, `replay`) and the `test.*` node
vocabulary are defined in the semantics part §8 and runs part §6. Expected
hashes that are impractical to compute by hand are shipped as
`"TBD-by-engine"`: the conformance suite fills them from the first canonical
engine run and freezes them — after which a changed hash is a breaking
change, not a test update.

## Versioning policy

- Each part carries independent semver, declared in its version header and
  echoed by documents (`formatVersion`) and records (`runVersion`).
- Patch: editorial. Minor: additive and backward compatible (new optional
  member, new builtin). Major: breaking.
- **Every breaking format change ships migration notes in the release and a
  mechanical migration in `Ara3D.NodeGraph.Migrations`.** Notes MUST state
  the hash impact: anything that changes canonical serialization or the
  hashed subset changes every graph hash and breaks run replay against old
  records.
- Cross-part coupling is explicit: runs depends on semantics' value hashing
  and format's graph hash; expressions and semantics share the value kinds.
  A major bump in a depended-on part forces at least a minor bump and a
  compatibility statement in the dependent part.
- Conformance vectors are part of the version: a release tags the vector
  set, and frozen `TBD-by-engine` values never change within a major
  version.
