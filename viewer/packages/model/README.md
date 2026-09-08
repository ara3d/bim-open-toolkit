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
| `table` | columnar tables with select, filter, sort and integer-key join |
| `mesh` | plain-data meshes and columnar instance records |
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
