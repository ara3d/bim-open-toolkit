# @bim-open-toolkit/model

The data contracts and pure operations the rest of the viewer is built from. It has no runtime
dependencies at all: no three.js, no renderer, no browser API, no other package in this repository.
Everything here is plain data and small pure functions, so it runs in a test, in Node, in a browser
and in an MCP server without change.

Full signatures with rationale: [docs/CONTRACTS-M1.md](docs/CONTRACTS-M1.md).

## The idea

Four decisions shape the whole package.

1. **Identity is a model revision plus an object id.** The same object at two revisions is two
   references, which is what a revision comparison needs. Keys are strings, so they work in maps,
   sets and saved documents.
2. **Everything a document holds is plain data.** No renderer object, no function, no `Set`, ever
   reaches a saved scene. Sets and lookups are built when they are used and thrown away.
3. **What is not known says so.** A missing fact has a reason. An unknown unit does not convert. A
   total refuses to add quantities in different units. Coverage counts the gaps.
4. **Failure is a value.** Operations return `Result<T>` with path-addressed diagnostics rather than
   throwing, so a caller can report exactly which part of a document was wrong and still open it.

Three things the type names do not say out loud, each of which cost an independent reviewer a
correction:

- An object record carries `ref`, an `ObjectRef`, not an `id`. The id within the model revision is
  `record.ref.objectId`.
- `objectKey` joins three percent-encoded parts with `|`, and `parseObjectKey` reads them back.
- `table()` takes entries, `[name, column]` pairs, the way `new Map()` does. `tableFromRecord()`
  takes `{ name: column }`.

## Module map

| Module | Holds |
|---|---|
| `result` | `Result<T>`, `Diagnostic`, and the combinators over them |
| `math` | `Vec3`, `Color`, `Matrix4` (column-major number arrays), `Bounds` |
| `identity` | `ModelRef`, `ObjectRef`, keys, equality, key parsing |
| `coordinates` | units, up axis, registration, and the conversions that are safe |
| `objects` | `ObjectRecord`, `ModelData`, lookups by key |
| `schema` | validating combinators that describe themselves as JSON schema |
| `sets` | sets of object keys with union, intersection, difference, membership |
| `style` | appearance, style rules, precedence, and the scene composition |
| `edits` | edit layers, their resolved effect, and a generic undo history |
| `view` | camera pose, projection, framing, saved views |
| `slices` | `StateSlice<S>`, the scene document, migration and round-trip |
| `table` | columnar tables with select, filter, sort and joins on integer or string keys |
| `mesh` | plain-data meshes, the same meshes as buffers, and columnar instance records |
| `instance-table` | instance records as a table, one column per component |
| `table-sets` | table rows selected by an object set, and read back into one |
| `facts` | observations, evidence, missing reasons, conflicts, coverage |
| `event` | change events, listeners, disposal |
| `session` | what a command may read and change |
| `command` | commands, registries and generated descriptors |
| `feature` | one capability as one module, with dependency ordering |

`src/index.ts` re-exports all of them one level deep, so `import { objectKey } from
'@bim-open-toolkit/model'` works.

## Using it

Validate something and report where it was wrong:

```ts
import { formatPath, integer, object, parse, string } from '@bim-open-toolkit/model';

const door = object({ id: string(), width: integer() });
const read = parse(door, { id: 'D1', width: 'wide' });
if (!read.ok) read.diagnostics.forEach((d) => console.log(formatPath(d.path), d.message));
```

Compose what the user sees, in the one order that composition happens:

```ts
import {
  deleteObjects, editLayer, resolveStyles, setOf, styleComposition, styleOf, styleRule,
} from '@bim-open-toolkit/model';

const keys = ['a', 'b', 'c'];
const layers = [editLayer('l1', 'Demolition', [deleteObjects(['a'])])];
const rules = [styleRule('r1', 'Fire doors', ['b'], { color: [1, 0, 0] })];
const resolved = resolveStyles(styleComposition(new Map(), layers, rules, setOf(['c'])), keys);
styleOf(resolved, 'b').color; // [1, 0, 0]
```

Save and reopen a feature's state:

```ts
import { emptyDocument, getSlice, integer, object, putSlice, stateSlice } from '@bim-open-toolkit/model';

const clipping = stateSlice('clipping', 1, object({ planes: integer() }), { planes: 0 });
const document = putSlice(emptyDocument(), clipping, { planes: 2 });
getSlice(document, clipping); // { ok: true, value: { planes: 2 }, diagnostics: [] }
```

Review the doors of a model: what is rated, what a survey settles, what to colour, what to draw.

```ts
import {
  cellOf, completeFacts, conflicting, coverageOfFacts, f32Column, fact, identityMatrix, indexFacts,
  instanceRecords, instanceTable, joinTablesOn, known, objectKey, objectRef, reconcile, resolveStyles,
  rowsInSet, setKeys, setOf, stringColumn, styleComposition, styleOf, styleRule, tableFromRecord, text,
  unknownFacts, withColumn, type InstanceRecord, type ModelRef,
} from '@bim-open-toolkit/model';

const model: ModelRef = { id: 'tower', revision: '2026-09' };
const door = (id: string) => objectRef(model, id);
const doors = [door('d1'), door('d2'), door('d3')];
const keys = doors.map(objectKey);

// What the sources say: one door rated, one with nothing recorded, one they disagree about.
const recorded = indexFacts([
  fact(door('d1'), 'fireRating', known(text('EI60'), [{ source: 'ifc' }])),
  fact(door('d3'), 'fireRating', conflicting([text('EI90'), text('EI60')])),
]);
const rated = completeFacts(recorded, doors, ['fireRating']);
coverageOfFacts(rated); // { total: 3, known: 1, missing: 1, conflicting: 1 }

// A site survey settles the disagreement.
reconcile([text('FD60')], [{ source: 'survey' }]).kind; // 'known'

// Colour every door without a known rating red.
const unrated = setOf(unknownFacts(rated).map((item) => objectKey(item.subject)));
const rules = [styleRule('unrated', 'Unrated doors', setKeys(unrated), { color: [1, 0, 0] })];
const resolved = resolveStyles(styleComposition(new Map(), [], rules), keys);
styleOf(resolved, objectKey(door('d2'))).color; // [1, 0, 0]

// The rows that draw, the third door placed but not drawn, the two that are unrated, and the
// schedule row beside each door.
const placed = instanceRecords(doors.map((_unused, index): InstanceRecord => ({
  meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: index,
  visible: index !== 2,
})));
const rows = withColumn(instanceTable(placed), 'objectKey', stringColumn(keys));
cellOf(rows, 'visible', 2); // false
rowsInSet(rows, 'objectIndex', unrated, keys).rowCount; // 2
const schedule = tableFromRecord({ objectKey: stringColumn(keys), width: f32Column([0.9, 1.2, 0.8]) });
joinTablesOn(rows, 'objectKey', schedule, 'objectKey', 'schedule.'); // 3 rows, widths alongside
```

## What is not here

- **No rendering.** No three.js types, no GPU buffers, no picking. `render` owns those; this package
  gives it the tables and the resolved styles to write.
- **No loading.** No file parsing and no network. `formats` owns those and produces `ModelData`,
  a representation table and diagnostics.
- **No unit guessing.** `metresPerUnit('unknown')` is `undefined` and every conversion built on it
  returns `undefined`. A caller decides what to do about it.
- **No registration transform.** `contextTransform` converts units and the up axis. Moving between a
  local frame and a project or geographic frame needs a placement this package does not carry.
- **No matrix inverse or decomposition.** Only what the composition path needs: multiply, transform a
  point or direction, transform bounds.
- **No bounded history.** `History<S>` keeps every state. A session that edits for hours will want a
  limit; adding one is a change to this module, not to its callers.
- **No document-wide slice validation.** `parseDocument` checks the envelope; each slice's own value
  is checked by `getSlice`, so one broken feature does not stop a scene from opening.
- **No renderer-side instance table.** `mesh` gives the columnar shape; binding it to draw calls,
  detecting changed rows and uploading them belongs to `render`.

## Tests

```
npm test -w @bim-open-toolkit/model
```

One test file per module, next to no fixtures, and no test touches the filesystem or a browser.
`test/session-fixture.ts` implements `Session` in about forty lines, which is the check that the
contract can actually be implemented.
