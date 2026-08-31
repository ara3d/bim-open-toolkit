# Architecture: the BimOpenFlow graph module and Gratify

> Decision (Christopher Diggins, 2026-08-31). Settles where node-graph editing
> code lives, and what may be added to Gratify. Supersedes the earlier reading
> that BimOpenFlow's canvas code is app-level detail to be pushed upstream.

## Decision

BimOpenFlow has its own **graph module**: a production-strength node-graph
editing layer, owned by this repo, built on Gratify's core machinery.

Gratify stays a general canvas UI library. Its `examples/node-editor` is a
demo — it shows what the primitives can do. It is not a deliverable, not a
dependency, and not the starting point for a node library. Nothing in
BimOpenFlow imports from it.

When the graph module needs something Gratify cannot do, the fix goes into
**Gratify's core** — the primitives every canvas UI uses. It does not go into
a graph-shaped layer inside Gratify.

## Why

The alternative — grow the demo into a shared node-editor library and have
BimOpenFlow specialize it — fails on three counts.

1. **The generic part is small; the specialized part is the product.** Strip
   away what Gratify's primitives already provide (`Anchor`, `Gesture`, `Pan`,
   `wireDist`, `painter.wire`) and the framework-neutral residue is a few
   hundred lines: grid surface, sockets, wire hit-testing, drag-to-wire,
   drag-to-move. Everything BimOpenFlow actually needs next is domain work —
   port-type compatibility, node status, inspectable wires carrying tables,
   verdict cross-probing, ghost nodes for agent-proposed edits, parameter
   promotion, templates. A shared node library would own the cheap part while
   the expensive part lives here anyway.

2. **Gratify is a git submodule.** Every change to it is a two-repo commit and
   a submodule bump. That cost is fine for primitives, which change rarely and
   serve every consumer. It is the wrong cost to pay on the critical path of
   ordinary graph-editor features, which is exactly what a graph layer in
   Gratify would put there.

3. **A demo is not a contract.** `examples/node-editor` exists to prove the API
   and to be read. Treating it as an upstream base would freeze demo decisions
   into a supported surface and make every BimOpenFlow feature start with an
   upstream negotiation.

## What goes where

**Gratify core** — canvas primitives, general to any canvas UI: layout, parts
and elements, channels and animation, gestures and hit-testing, anchors,
painting, input routing, theming, the runtime and its external-sync seam.
Admission test: a second, unrelated canvas UI would want it. Nothing in Gratify
knows what a port type, a node status, or a catalog is.

**BimOpenFlow graph module** — everything about editing *this* kind of graph:
node bodies and headers driven by the node catalog, port typing and connection
rules, status badges, wire inspection, selection and cross-probing, agent-edit
diffs, and the mapping from gestures to store operations.

Two live examples of the rule, both already recorded in `NOTES.md`:

- The external-store sync workaround in `canvasEditor.ts` (a store dispatch
  nested inside a Gratify update is silently overwritten, so the sync is
  deferred one microtask). The real fix is a core `setDoc` / external-sync API
  in the runtime — a primitive every embedded Gratify UI needs, graph or not.
- Anchor `meta` reaching the app as `unknown`, forcing local casts. The real
  fix is a generic meta parameter on `Anchor` and `Query` in core.

Both are core gaps surfaced by graph work. Neither is a reason to put graph
code in Gratify.

## Consequences

- The graph module is a package in the web workspace
  (`bimopenflow/web/packages/graph/`, `@bimopenflow/graph`), consumed by
  `@bimopenflow/app`. It is versioned with the app; it is not a library with an
  external API-stability commitment.
- `platoflow/web/src/editor/` (~6,500 lines on Gratify) is reference material
  for the module, not an upstream. It is the best available evidence of what a
  mature version needs — wires, widgets, cards, subgraphs, layout, picker,
  context menu — and should be harvested deliberately rather than ported
  wholesale.
- Gratify's demo may be updated to track core API changes. It never grows to
  serve BimOpenFlow.
- Gratify changes stay small, general, and infrequent, which keeps the
  submodule bump cheap.
