# 06 — Valve isolation trace

Brief section 6, row "Valve isolation": F18 directed lines/arrows, F07
affected object sets, F11 navigation. Required input: "Accepted topology and
trace coverage; nearby pipes are not assumed connected."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `nodes` | `nodeId` | string | a pipe junction, fixture or valve location |
| `segments` | `objectId` | string | one pipe/segment |
| | `fromNodeId` | string | FK to `nodes` |
| | `toNodeId` | string | FK to `nodes` |
| | `topologyStatus` | string | `"accepted"` \| `"unverified"` — whether this connection is trusted topology |
| `valves` | `objectId` | string | one valve |
| | `nodeId` | string | which node the valve sits at; a closed valve blocks traversal through that node |

The workflow parameter is `closedValveIds: string[]` — which valves are
closed for this trace, and `startNodeId` — where the isolation trace begins
(e.g. the fixture being serviced).

## Rules

The brief's constraint "nearby pipes are not assumed connected" and
"trace coverage" together mean: this workflow only ever traverses a
`segment` whose `topologyStatus` is `"accepted"`. An `"unverified"` segment
is never silently included in — or excluded from — the affected set as if
it were known; it is reported separately as a trace-coverage gap.

1. Build a graph of `accepted` segments only. Starting from `startNodeId`,
   perform a breadth-first traversal, refusing to pass through any node
   that hosts a valve in `closedValveIds`.
2. **Affected set** = every node (and the accepted segment that reached it)
   visited by that traversal, excluding `startNodeId` reached through a
   closed valve (i.e. the closed valve itself stops the trace at that
   branch).
3. **Trace-coverage exceptions** = every `unverified` segment that touches
   a node already in the affected set (on either end). This means: "this
   pipe might extend the affected area, but its connection isn't accepted
   topology, so it is not included — check it by hand." An unverified
   segment that never touches the affected set is not reported (it is out
   of scope for this trace, not a gap in it).
4. A segment whose traversal would only be reachable *through* a closed
   valve is neither in the affected set nor a coverage exception — closing
   the valve is working as intended, not a gap.

## Worked example (prose)

Nodes N1..N6. Segments (all `accepted` unless noted):
- SEG-1: N1–N2
- SEG-2: N2–N3
- SEG-3: N3–N4
- SEG-4: N2–N5 (`unverified`)
- SEG-5: N4–N6

Valve V1 sits at N3, closed for this trace. `startNodeId` = N1.

Traversal from N1: N1 → N2 (via SEG-1) → N3 (via SEG-2). N3 hosts closed
valve V1, so traversal stops there — SEG-3 (N3–N4) and everything beyond it
(N4, N6, SEG-5) is **not** affected (isolation worked) and is not a
coverage gap (it was never reachable, valve or not — wait, it would be
reachable if V1 were open, but since it's closed by design, it's excluded
by rule 1, not flagged).

Affected set: N1, N2, N3 (up to and including the closed valve's node),
segments SEG-1 and SEG-2.

SEG-4 (N2–N5, unverified) touches N2, which is in the affected set → trace
coverage exception: "SEG-4 might extend the affected area past N5, unverified."

Expected affected set: nodes N1, N2, N3; segments SEG-1, SEG-2.
Expected exceptions: SEG-4 (unverified, touches affected node N2).

## Assumptions

- The node hosting a closed valve is included in the affected set (water
  reaches the valve; it just can't pass through), but nothing beyond it is.
- An unverified segment is reported as an exception only when it touches
  the affected set; this keeps the exception list focused on genuine
  coverage gaps at the boundary of the trace, not every unverified segment
  in the whole network.
