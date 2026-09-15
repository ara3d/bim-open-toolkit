# PlatoFlow × IFC — prioritized design principles

> Drives `platoflow-ifc-design.md` and everything downstream of it. When two principles
> conflict, the **lower number wins**. When a proposed change can't cite a principle, that
> is a smell — either the change is wrong or this list is missing something, and this file
> gets amended first (it is versioned; amendments are commits with rationale).
>
> Origin: four principles proposed by Christopher Diggins 2026-08-09, questioned and
> restructured (see the design doc's history and the critique summarized in §"Changes from
> the original four" below). To be mirrored into the project's `AGENTS.md` at scaffold time.

## P0 — The goal: sustained agent velocity

Fixing and extending this system quickly — by AI agents, indefinitely, without regressions
— is the point. Every principle below is a *means* to this and is justified by it. A
proposal that improves elegance, performance, or feature count but slows future agents
down loses.

Two standing obligations follow directly:

- **Agent-facing docs are load-bearing or deleted.** A small trusted set (this file, the
  design doc, per-folder `AGENTS.md`) is kept current in the same commit as the change
  that affects it. A stale doc is worse than none: agents rely on what they find.
- **Prefer structure over documentation.** The best agent-facing doc is a codebase with
  exactly one obvious place per concern. Docs explain *why*; the code's shape should make
  *where* and *how* self-evident.

## P1 — One headless core; UI is a view

The graph (`structure + values` JSON) and its evaluator are complete, runnable, and
testable with no canvas, no Gratify, no browser. Anything a user can build must round-trip
through the JSON byte-identically; nothing meaningful may live only in UI state.

*Overrules:* any feature whose semantics can only be exercised through the UI — redesign
it until it can't be. This principle is what makes P3 cheap and P4 possible.

## P2 — Few concepts, and all coupling through named seams

Simplicity is measured in **concepts an agent must hold**, not lines of code. This system
has four: `SceneValue` (what flows), `NodeDef` (what nodes are), `Intent` (how graphs
change), and the four-layer graph JSON (what graphs are). Adding a fifth requires amending
this file first.

All coupling routes through three seams, and nothing else:

1. **The registry** — what node kinds, wire types, and param widgets exist. String ids +
   versions everywhere; the core never imports a concrete node or switches on a kind.
2. **The reducer** — the single choke point for every graph mutation: mouse, keyboard,
   MCP agent, undo, batch. If a mutation bypasses it, that's a bug by definition.
3. **The JSON** — the single authoritative representation; everything else is a
   projection of it.

*Overrules:* convenient shortcuts (a node peeking at another node, UI writing graph state
directly, a special-cased kind in the evaluator). The old PlatoFlow's six-switch node
model is the cautionary tale.

## P3 — MCP agents are first-class users from day zero

Graph create / edit / evaluate / inspect over MCP ships in **V0**, not later. This
bootstraps the whole system: agents author the test-corpus graphs, the demo workflows, and
the regression suite *before* the mouse UI is polished — and in doing so continuously
verify P1 and P2 (the MCP surface is nothing but the headless core plus the reducer, so if
it's hard to expose, the architecture has drifted).

Agent edits arrive as ordinary Intents: undoable, reviewable, animated into view. Human
and agent share one edit path or the system has failed P2.

*Overrules:* "we'll add the API once the UI settles." The API *is* the system; the UI
settles on top of it.

## P4 — Smart verification, not exhaustive

Tests target the seams, run fast, and never overlap concerns:

- **Round-trip goldens** — load → save byte-identical; strip `layout`/`session` → same
  evaluation. (Requires determinism: same inputs, same outputs, always — treat any
  nondeterminism as a bug, not a tolerance.)
- **Headless semantic fixtures** — graph JSON + small recorded BOS model in; tables,
  counts, channel hashes out.
- **UI intent tests** — headless Gratify harness asserts that gestures produce the right
  Intents/JSON, never asserting on evaluation results.

A test that needs UI and semantics together is a design smell, not a coverage win. No
exhaustive scans, no re-running the world per change: an agent should know from the test
layout *which* suite a change can break.

*Overrules:* coverage theater, snapshot-everything testing, and slow gates that make
agents skip verification.

## P5 — Choose representations for scale; defer code optimization

Two different things hide under "avoid premature optimization," and they get opposite
treatment:

- **Data representation is a semantic decision, made up front.** Views-over-shared-store
  instead of deep copies, columnar tables, index arrays, channels — these are chosen now
  because retrofitting them later rewrites the system. Choosing a representation that
  precludes scale is premature *pessimization*.
- **Code optimization is deferred until measured.** No caching layers beyond the one
  memoizer, no workers, no virtualization, no clever pooling until a profile demands it.
  Undo is a snapshot stack of JSON strings until proven otherwise.

*Overrules:* both failure modes — speculative machinery (P5b) and "we'll fix the data
model later" (P5a).

---

## Changes from the original four (critique record)

The original list: (1) simple architecture minimizing coupling, always; (2) avoid
premature optimization; (3) prioritize speed/ease of agent iteration via smart testing +
disciplined agent docs; (4) MCP graph editing built early to bootstrap.

1. **Original #3 was promoted to P0.** As written, the list stated two means (simplicity,
   no-premature-optimization) *above* the end they serve. A prioritized list resolves
   conflicts; when simplicity and agent velocity genuinely conflict (e.g., adding a test
   harness, an MCP surface, or a registry indirection is *more* architecture, not less),
   the original ordering would argue against the very scaffolding that agents need. Goal
   first, means below it.
2. **"Always preferred" was dropped.** Absolutes lose their first real argument. P2 keeps
   the substance (concept count + named seams) in falsifiable form: you can point at a PR
   and say which seam it violates.
3. **Original #2 was split (P5).** Unqualified, it argues against the SceneValue
   view-over-shared-store design — which *is* an up-front efficiency decision, and a
   correct one. The representation/code split resolves the tension instead of leaving it
   to taste.
4. **Original #4 was strengthened and moved up (P3), and it revises the design doc:**
   PlatoFlow-as-MCP-server was previously tiered V2; the edit/evaluate/inspect surface is
   now **V0** (copilot assistance and screenshot tooling remain V2). Rationale: it is
   nearly free given P1, and it converts the test corpus and demo workflows from chores
   into bootstrap output.
5. **One thing the original list didn't say, now explicit inside P4: determinism.**
   Byte-identical round-trips and golden tests are only meaningful if evaluation is
   reproducible; it is cheap to demand from day zero and expensive to bolt on.
