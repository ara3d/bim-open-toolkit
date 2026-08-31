# DataFlow Graph Run Records

**Part:** runs | **Version:** 0.1.0 | **Status:** Draft

Defines the run record: a frozen evaluation. A graph is source and keeps
evolving; a **run** is the thing archived, replayed, and — once signing
lands — signed and submitted as evidence. The file extension is
`.run.json`.

Normative words (MUST, MUST NOT, SHOULD, MAY) follow RFC 2119.

## 1. What a run freezes

A run record is produced when a Run completes (semantics part §6). It pins:

1. **The graph** — by graph hash (format part §6). The document itself is
   not embedded; it is handed over alongside the record as the replay
   instrument.
2. **Every external input** — by content hash. External inputs are the
   resolved contents behind `FilePath` and `ModelRef` parameters (the model,
   external CSVs, …), identified by content, never by path.
3. **Every node output** — by value hash (semantics part §1.1), for every
   node that produced outputs in the Run.
4. **Selected outputs in full** — serialized values (§3), by default every
   terminal output (an output port with no outgoing edge); engines MAY
   record more.
5. **Effects** — which Effect nodes executed, in order, and their status.
6. **Provenance** — UTC timestamp and engine version.

## 2. Record shape

```jsonc
{
  "runVersion": "0.1.0",              // version of this part
  "graphHash": "…64 lowercase hex…",  // bare hex, format part section 6
  "engineVersion": "Ara3D.DataFlowEngine 0.1.0",
  "timestampUtc": "2026-08-31T14:03:22.117Z",
  "inputs": [
    { "node": "m1", "param": "path", "contentHash": "sha256:…",
      "source": "models/tower-a.bos" }      // source is informational only
  ],
  "nodeOutputs": {
    "m1.out": "sha256:…",               // "nodeId.port" -> value hash
    "sum.out": "sha256:…"
  },
  "recordedOutputs": {
    "sum.out": { "kind": "Integer", "value": 12 }   // serialized values, section 3
  },
  "effects": [
    { "node": "export", "status": "ok" }  // execution order; status ok | failed
  ]
}
```

All members shown are required except `source` (informational; hashes, not
paths, carry identity) and failed effects' optional `error` text. Note the
two hash styles: `graphHash` is bare lowercase hex (format part §6), while
input content hashes and value hashes carry the `sha256:` prefix (semantics
part §1.1). `inputs`
is sorted by (node, param); `effects` is in execution order (which is
normative, semantics part §6). The record is serialized with the format
part's canonical JSON rules (§6 there), so a run record is itself
hashable and diffable. The timestamp is RFC 3339 UTC with millisecond
precision and a `Z` suffix; it records when the Run completed.

Unready or poisoned nodes at Run time appear in neither `nodeOutputs` nor
`recordedOutputs`; a failed Effect node appears in `effects` with
`"status": "failed"`.

## 3. Serialized values

`recordedOutputs` embeds values as JSON:

- Boolean, Integer, Text — `{ "kind": ..., "value": ... }` with the natural
  JSON value.
- Number — `{ "kind": "Number", "value": ... }`; finite values as JSON
  numbers (canonical number formatting per the format part), non-finite as
  the strings `"NaN"`, `"Infinity"`, `"-Infinity"`.
- Table — `{ "kind": "Table", "columns": [ { "name": ..., "kind": ...,
  "cells": [...] } ] }`, columns in table order, cells in row order, JSON
  `null` for null cells, Number cells encoded as above.

The serialized form MUST hash (via the semantics part §1.1 encoding of the
value it denotes) to the matching entry in `nodeOutputs`; a record where
they disagree is corrupt.

## 4. Replay

Replay verifies that a run record is what it claims. Given the record, the
graph document, and the current external inputs:

1. **Graph check** — the document's graph hash MUST equal `graphHash`;
   otherwise replay is refused with reason `graph-mismatch`.
2. **Input check** — every `inputs` entry's content hash MUST equal the
   hash of the corresponding resolved input; otherwise replay is refused
   with reason `input-mismatch`, naming the first mismatched (node, param).
3. **Recompute** — evaluate the graph over the pinned inputs. Replay is
   effect-free: node outputs are recomputed (they are pure functions of
   inputs, per the semantics part §2, for Effect nodes too), but no world
   change is performed.
4. **Verdict** — replay succeeds iff every recomputed output hash equals
   its `nodeOutputs` entry. The first divergence (dependency order, ties by
   node id) is reported with reason `output-mismatch` and the node id. A
   divergence with matching inputs is an engine determinism bug or a record
   produced by a different engine/spec version.

A replay with matching input hashes MUST reproduce all output hashes.

## 5. Signing (out of scope for v0.1)

Placeholder. A future minor version adds detached signatures over the
canonical bytes of the run record (and a record hash field), so an official
can verify who ran it and that nothing changed. Nothing in v0.1 may make
that impossible: canonical serialization is already required, and consumers
MUST ignore no part of the record when hashing it. The evidence package
(record + graph + pinned inputs + rendered report) is `BimOpenFlow.Evidence`'s
concern, not this part's.

## 6. Schema and conformance

`schemas/run.schema.json` gives the record shape. Vectors in `conformance/`
use the semantics part's test vocabulary and harness, plus a `replay` step:
`{ "action": "replay", "record": ..., "providedInputs": [ { "node": ...,
"param": ..., "contentHash": ... } ] }` with expected outcome `ok`,
`graph-mismatch`, `input-mismatch`, or `output-mismatch`.

## 7. Versioning

This part is versioned independently (semver). It additionally depends on
the semantics part's value hashing and the format part's graph hash: a
major bump of either invalidates replayability of existing records, and
this part's migration notes MUST state how archived records are handled
(re-recording vs dual-hash verification).
