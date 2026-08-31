# DataFlow Graph Evaluation Semantics

**Part:** semantics | **Version:** 0.1.0 | **Status:** Draft

Defines what it means to evaluate a valid graph document (see the format
part) against a node catalog. The prime rule: **evaluation is deterministic.
Same graph, same inputs, same outputs — always. Any observed nondeterminism
is an engine bug, not a tolerance.**

Normative words (MUST, MUST NOT, SHOULD, MAY) follow RFC 2119.

## 1. Values

Edges carry values of exactly five kinds:

| Kind | Definition |
|---|---|
| Boolean | true or false |
| Integer | signed 64-bit integer |
| Number | IEEE 754 binary64 (double) |
| Text | a sequence of Unicode code points |
| Table | ordered named columns, each a typed cell sequence of equal length |

A Table column has a name (unique within the table, order significant) and a
column kind — Boolean, Integer, Number, or Text (no nested tables in v0.1).
Cells are values of the column kind or null. **Null exists only inside table
cells and inside expression evaluation (see the expressions part); an edge
never carries a bare null.**

Port types are the five kinds plus `Any`. `Any` accepts every kind. The only
widening is Integer → Number, applied at the port boundary (an Integer output
wired to a Number input arrives as the equal Number).

### 1.1 Value hashing

Several rules below key on value identity, so value hashing is normative.
The hash of a value is `"sha256:" + lowercase-hex(SHA-256(enc(v)))` where
`enc` is:

- Boolean — byte `0x01`, then `0x00` (false) or `0x01` (true).
- Integer — byte `0x02`, then 8 bytes little-endian two's complement.
- Number — byte `0x03`, then 8 bytes little-endian IEEE 754 binary64.
  Any NaN is first canonicalized to the bit pattern `0x7FF8000000000000`.
  Negative zero is preserved (it is a distinct double).
- Text — byte `0x04`, then 8 bytes little-endian byte length, then the
  UTF-8 bytes. Code points are hashed exactly; no Unicode normalization.
- Table — byte `0x05`, then 8 bytes little-endian column count, then per
  column in table order: the column name (Text encoding, with its tag), one
  column-kind tag byte (`0x01` Boolean, `0x02` Integer, `0x03` Number,
  `0x04` Text), 8 bytes little-endian row count, then the cells in row
  order: `0x00` for null, else `0x01` followed by the cell's `enc` payload
  for the column kind (tag byte included).

Two values are *equal* iff their hashes are equal.

## 2. The node contract

For each (kind id, version) the catalog declares: input ports (name, type,
required or optional), output ports (name, type), parameters (name, kind,
per the format part's table), and a **capability**: `Pure` or `Effect`.

A node's outputs MUST be a mathematical function of exactly:

1. its kind id and version,
2. its parameter values,
3. the values on its connected input ports.

Nothing else — no clock, no randomness, no ambient files, no evaluation
order, no other node's state. A kind whose output depends on external
content (a file, a model) MUST take that content as an input value or
declare the dependency through a content-hashed parameter (`FilePath`,
`ModelRef`) so the runs part can pin it; the engine resolves such parameters
to content before evaluation, and the content hash — not the path — is what
identifies the input.

`Effect` marks a node that changes the world (writes a file, patches a
model, sends output). Effect nodes execute only inside a Run (§6).

A required input port with no edge, or an unconfigured required parameter,
makes the node *unready*: it does not evaluate, it is not an error, and
everything downstream of it is unready too.

## 3. Whole-graph evaluation

Evaluation of a graph against resolved inputs proceeds in dependency order:
a node evaluates only after all nodes feeding its inputs have produced
values. Any order consistent with the dependencies yields the same result
(guaranteed by §2); where an observable order exists (§6 effects,
diagnostics), the engine MUST use topological order with ties broken by
node id ascending by Unicode code point.

Cycles cannot occur: a document with a cycle is invalid per the format part
and MUST be rejected before evaluation.

A node that throws or reports failure poisons its downstream: dependents do
not evaluate and report the originating node id. Failure of one branch MUST
NOT affect independent branches.

## 4. Memoization

Engines SHOULD memoize node outputs. The memo key for a node evaluation is:

```
(kind id, kind version,
 canonical serialization of the node's values-layer object,
 for each connected input port in name order: (port name, value hash))
```

When the key matches a cached entry, the engine MUST reuse the cached
outputs and MUST NOT re-execute the node — for Pure nodes re-execution would
be unobservable by §2, so this rule exists to make the conformance suite's
evaluation counts (§8) well-defined and to keep standing evaluation cheap.
Effect nodes are never memoized across Runs: every Run executes every
reachable Effect node exactly once (§6).

Caches are transient. They are never persisted into the document; reloading
a graph recomputes (cheaply, through the memoizer).

## 5. Dirtiness

Any change to the `structure` or `values` layers marks the directly affected
nodes dirty; dirtiness propagates to all downstream (transitively dependent)
nodes. Changes to `layout` or `session` never dirty anything.

Re-evaluation visits dirty nodes in dependency order. A dirty node whose
memo key is unchanged (or whose recomputed output equals the previous value)
stops propagation: its dependents' inputs are unchanged, so they are clean
again without re-executing. Evaluation counts under this rule are what the
conformance vectors assert.

## 6. Runs and effect gating

Standing evaluation (§7) is effect-free: `Pure` nodes evaluate freely;
`Effect` nodes never execute. An Effect node outside a Run reports state
*pending*, produces no outputs, and its downstream is pending too.

A **Run** is an explicit, user- or agent-initiated execution over one
consistent snapshot of the graph and its inputs:

1. The engine brings all Pure nodes up to date (standing evaluation).
2. Reachable, ready Effect nodes execute exactly once each, in topological
   order, ties broken by node id ascending. This order is normative because
   effects are observable.
3. An Effect node's failure stops its own downstream but not independent
   effect chains; effects already executed are not rolled back (effects are
   not transactional in v0.1).
4. The completed Run is frozen into a run record per the runs part.

Nothing outside a Run may change the world. An engine extension or node that
performs effects during standing evaluation does not conform.

## 7. Standing evaluation sessions

An engine hosts a graph in a **session**: a standing evaluation that
observers (panes, sinks, agents) subscribe to. Requirements:

- **Consistent snapshots.** An observer notification exposes node outputs
  from a single evaluation of a single document state. Observers never see a
  mix of values from before and after a change.
- **Eventual freshness.** After a change, once the engine reports the
  session up to date, all outputs reflect the latest document state.
- **No observer effects.** Observing never executes Effect nodes and never
  changes any value or hash.
- Scheduling, batching of rapid edits, and notification granularity are
  engine choices; they are unobservable in values by determinism.

## 8. Conformance vocabulary and vectors

Vectors in `conformance/` use a small test vocabulary every engine running
the suite must provide (in its test harness, not its product catalog):

| Kind (version 1) | Capability | Ports and parameters |
|---|---|---|
| `test.const` | Pure | out `out: Any`. Params: `kind` (Enum of the five kinds), `value` (Json, interpreted as that kind). |
| `test.negate` | Pure | in `in: Integer`, out `out: Integer`. Arithmetic negation. |
| `test.add` | Pure | in `a: Integer`, `b: Integer`, out `out: Integer`. |
| `test.probe` | Pure | in `in: Any`, out `out: Any`. Identity; the harness records each execution. |
| `test.effect` | Effect | in `in: Any` (optional), out `out: Any` (passes input through). The harness records each execution. |

The harness MUST report, per conformance step, how many times each node
executed (memo hits and clean skips count as zero) and the order in which
Effect nodes executed.

Vector steps are: `evaluate` (bring the session up to date), `setValue`
(`node`, `param`, `value` — a values-layer edit), and `run`. Shipped
vectors: memo hit on unchanged re-evaluation, dirty propagation confined to
the changed branch, effect gating across evaluate/run, and deterministic
effect ordering.

## 9. Versioning

This part is versioned independently (semver). Changing value hashing, memo
key composition, or effect ordering is breaking: it invalidates recorded
runs' replayability and requires a major bump with migration notes.
