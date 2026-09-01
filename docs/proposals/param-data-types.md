# Proposal: additional parameter data types

> Proposal (Claude + Christopher Diggins, 2026-09-01). Reviews a proposed list
> of new data types (Vector2/3, UnitVector2/3, NumberInterval, Bounds2D/3D,
> Angle, Color, ColorInterval, ColorGradient, ColorPalette, Rotation3D),
> recommends which to build, which to drop, and adds the types the node
> catalog is actually asking for. Measured against the 230 parameter
> declarations across the node packs in `src/BimOpenFlow.Nodes.*`.

## 1. Which type system is this?

The toolkit has two type systems, and the proposed list belongs to only one
of them.

**`ValueKind` / `PortType`** — what flows along an edge. Five members:
Boolean, Integer, Number, Text, Table. Adding one costs a `FlowValue`
subtype, a port-compatibility rule, a hashing rule, a run-record encoding,
and a decision in every pane about how to display it. Expensive, and the
`core-node-sets` ground rule already answers the demand: *tables are the
currency*. A `Vector3` wire type would fragment that — a list of points is a
three-column table and stays one.

**`ParamKind`** — how one authored value is edited and written down. Ten
members today. The document layer stores every parameter as a canonical
string (`spec/dataflow-graph/format/format.md` §4); `ParamKind` says how to
parse that string and which editor to show. Adding one costs:

1. a row in the spec's canonical-form table,
2. an enum member in `Ara3D.DataFlowEngine.Abstractions/Params.cs`,
3. the same member in `contracts/contracts.json` (a host test asserts parity),
4. a typed accessor on `ParamValues`,
5. a normalizer in `bimopenflow/web/packages/app/src/paramText.ts`,
6. an editor branch in `paramsPane.ts`.

**Every type on the list is a `ParamKind`.** None should become a wire type.

### Forward compatibility is already free

`editorFor` in `paramsPane.ts` falls through to a plain text input for any
kind it does not recognize. An old web client meets a new `Color` param and
shows `#ff8800` in a text box — degraded, not broken. That property is worth
stating as a rule in the spec, because it is what makes adding kinds cheap:
**the canonical string form must always be hand-editable text.** That rule
rules out any kind whose canonical form is binary or deeply nested, and it is
the reason each recommendation below names its string form.

### Refactor `editorFor` before the fourth kind

`editorFor` is an if-chain over kinds with a text fallback. At ten kinds it is
fine; at twenty it is the file every parallel agent edits at once. Before
landing more than about three new kinds, split it into a registry —
`Map<ParamKind, EditorFactory>` with one small module per editor group
(scalars, dates, colors, vectors). That keeps two agents adding two kinds from
colliding, and it is a mechanical change with the existing tests as cover.

## 2. Review of the proposed list

### Build

**`Color`** — the best value-to-cost ratio on the list. Canonical form
`#rrggbb` or `#rrggbbaa`, lowercase. The editor is `<input type="color">`, one
branch. Demand is immediate: `ColorNode.Unmatched` is a hardcoded gray
constant that should be a parameter, and `HideNode`, `IsolateNode`, and
`OpacityNode` all want an authored highlight color.

**`Vector3`** — canonical form `x,y,z` in round-trip Number form. `CameraNode`
declares six parameters (`posX`…`targetZ`) where two would do, and offset,
translation, and non-cubic voxel size all want it. The editor is three number
fields in a row.

> One trap: `BimContainmentNode` and `BimNearestNode` also declare `x`, `y`,
> `z` parameters, but those are *column names*, not coordinates. They must
> stay text (see `ColumnRef` in §3). Confusing the two would be a silent
> regression, so the canonical form should be strict enough that a column name
> never parses as a vector.

**`Angle`** — worth a distinct kind only because of the unit problem: authors
think in degrees, math wants radians. Canonical form is **degrees**, as a
round-trip Number — human-readable in the document, matching how BIM tools
present angles. The conversion lives in the accessor (`GetRadians`), not in
every node.

**`Rotation3D`** (rename `Rotation3` for consistency with `Vector3`) —
rotation representation is a real fork: Euler, axis-angle, quaternion. For an
*authored* value there is one humane answer. Canonical form is **intrinsic
Euler XYZ in degrees**, `rx,ry,rz`, and the spec should say "intrinsic XYZ"
explicitly, because leaving the convention implicit is how rotation bugs are
born. Do not expose quaternions as a parameter kind; nobody types one.

**`Bounds3D`** — canonical form `minx,miny,minz,maxx,maxy,maxz`, with
`min <= max` per axis a validation rule, and an empty string meaning unset
rather than a degenerate box. Real demand: section boxes and spatial filters.
Note that bounds already exist as *tables* (`BoundingBoxesNode` output); this
kind is for the authored single box, and its long-term payoff is a "capture
from the 3D view" button on the editor rather than typing six numbers.

**`ColorGradient`** — `ColorNode.colorMap` is currently an Enum over three
hardcoded ramps, which is exactly the parameter users will want to customize
first. Canonical form is a comma-separated list of hex colors, evenly spaced —
which is precisely what `ColorMaps.Gradient` already assumes, so the existing
math needs no change. Positioned stops (`0.3:#ff0000`) are a later extension
the format leaves room for.

**`ColorPalette`** — same canonical form as `ColorGradient` (a hex list) but
different meaning: indexed lookup rather than interpolation. That difference
is real enough to justify a separate kind — the editor shows discrete swatches
rather than a ramp, and the accessor returns a lookup rather than a sampler.
It replaces the hardcoded `ColorMaps.Category10`.

**`NumberInterval`** — canonical form `min..max`, either side omittable
(`..100`, `5..`) so half-open ranges need no sentinel. Demand is the from/to
parameter pair, which already appears in `DateFilterNode` and is implied by
every numeric filter. Add `DateTimeInterval` with the same `..` form at the
same time; the two share an editor shape.

**`Vector2`** and **`Bounds2D`** — correct and cheap, but nothing in the
current catalog needs them. Build them when the first node does, not before;
the canonical forms (`x,y` and `minx,miny,maxx,maxy`) should be reserved in
the spec now so the eventual addition is not a naming argument.

### Do not build

**`UnitVector2` / `UnitVector3`** — normalization is a validation rule, not an
editor. A separate kind buys one `if` in the accessor and costs a permanent
enum member plus the question of what the editor does when the author types a
non-unit value (silently renormalize? refuse? both are bad). Where a node
genuinely needs a direction, either use `Vector3` and normalize at eval, or
use the honest UI the catalog already reaches for — `SpacingNode.axis` is an
Enum over `x`/`y`/`z`, and that is better than a vector field for the common
case.

**`ColorInterval`** — this is a two-stop `ColorGradient`. Two kinds with the
same canonical form and the same semantics, differing only in length, is the
kind of near-duplicate that makes a catalog hard to learn.

## 3. What the catalog is actually asking for

The proposed list is geometry- and color-shaped. Counting the 230 parameter
declarations in `src/BimOpenFlow.Nodes.*` points somewhere else first.

**`ColumnRef` and `ColumnList` — the highest-value additions, not on the
list.** 58 parameters are declared as `Text` carrying
`SuggestSource.ColumnsOf(...)`. That is the single most repeated pattern in
the entire catalog, and it is expressed as an advisory annotation on an
untyped string. Promoting it to real kinds gives a proper picker instead of a
datalist, gives catalog validation something to check (a column that does not
exist is an error before the run, not during it), and turns
`SuggestSource.ColumnsOf` from an annotation into the kind's own definition.
`ColumnList` handles the comma-separated multi-column parameters
(`TableProjectNode.columns`, `TableDropNode.columns`, and about a dozen more)
with a chip editor rather than a comma-typing exercise. Canonical forms: the
column name, and a comma-separated list.

**A `Unit` annotation, not a `Length` kind.** The genuine gap in a BIM tool is
that a Number parameter means nothing without units — `VoxelizeNode.size` is
*1* of what? Millimeters and feet both appear in real models. The wrong fix is
a `Length` kind, because units are orthogonal: a `Vector3` offset and a
`Bounds3D` section box need them just as much as a scalar does. The right fix
is an optional `Unit` field on `ParamSpec`, alongside the existing optional
`Suggest` — the same pattern, applied to a second orthogonal concern. The
editor shows the unit as a suffix and can offer conversion; the canonical
value stays in one declared base unit so hashing stays stable.

**`Fraction`** — a Number constrained to 0..1, shown as a slider.
`DecimateNode.keepFraction`, `OpacityNode.alpha`, and
`TableSampleNode.fraction` are all this, and all currently accept 7 with no
complaint.

**`TextList`** — comma-separated free text (`BimRoomsNode.categories` is
`"Rooms,Spaces"`, `TableSplitColumnNode.names`, and others). Same chip editor
as `ColumnList`, without the column validation.

**A named convention for point-column triples.** `BimContainmentNode` and
`BimNearestNode` each declare three `Text` parameters meaning "the columns
holding a point" — and `BimNearestNode` declares two such triples. This is a
repeated shape, and the cheapest honest fix is not a new kind but a shared
`ParamSpec` factory in `BimOpenFlow.Nodes.Support` that emits the triple with
consistent names, defaults, and suggestions. Worth doing before a fifth node
copies it.

## 4. Recommended order

Phased so each phase is independently shippable and the later phases are
optional.

**Phase 1 — pays for itself immediately.** Split `editorFor` into an editor
registry. Add `Color`, `ColumnRef`, `ColumnList`, `Fraction`. Convert
`ColorNode.Unmatched` to a parameter, and convert the 58 `ColumnsOf` sites to
`ColumnRef`/`ColumnList` mechanically.

**Phase 2 — geometry.** Add `Vector3`, `Angle`, `Rotation3`, `Bounds3D`, and
the `Unit` annotation on `ParamSpec`. Migrate `CameraNode` to two `Vector3`
parameters (a node version bump, with the old version kept per the catalog's
versioning rule).

**Phase 3 — the rest.** `ColorGradient`, `ColorPalette`, `NumberInterval`,
`DateTimeInterval`, `TextList`. Reserve `Vector2` and `Bounds2D` canonical
forms in the spec without implementing them.

**Declined:** `UnitVector2`, `UnitVector3`, `ColorInterval`.

## 5. Open questions

- **Does `Unit` belong on `ParamSpec` or in the graph document?** A project
  working in feet wants every length parameter shown in feet, which is a
  document- or session-level preference, not a per-parameter one. The
  annotation above declares the *base* unit; the display preference is a
  separate, later decision.
- **Should catalog validity check `ColumnRef`?** Making a nonexistent column a
  validity error is the payoff of the kind, but column sets are only known
  once upstream nodes have evaluated. This likely lands as a warning at edit
  time and an error at run time.
- **Does `Bounds3D` want a capture-from-viewport affordance?** If yes, the
  parameter editor needs a channel back to the 3D pane, which the panes
  contract does not currently provide. Worth knowing before the editor is
  written, not after.
