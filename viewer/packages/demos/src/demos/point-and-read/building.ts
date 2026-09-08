// The model the four Inspect demos read, and the derivations all four take from it: the object
// record and the facts of each object, the box each object occupies, the storey each object belongs
// to, and one table of the columns a colouring can use.
//
// Everything is computed from the `ModelData` and `Geometry` the viewer opened, not from the
// generator that made one of them: the demos open Snowdon Towers by default, and a model read from
// a file has no generator to ask. What the file does not carry stays absent rather than filled in.
//
// A BFAST carrying the BOS tables records far more than geometry: one parameter table of 1.6 million
// rows over Snowdon, every one of its 51,139 objects carrying a sheet of between three and a hundred
// and twenty properties, and one of seven source documents named for each. The loader decodes those
// into columns (`formats/src/properties.ts`); this index says which columns belong to which object
// key and holds nothing else, so the inspector reads one object's few dozen rows rather than walking
// the table again after every change event.
//
// It still records no observations - the known/missing/conflicting vocabulary of `Fact` - so a
// loaded model has no facts and this says so rather than dressing a property up as one. What it does
// record, and what the parent walk alone missed, is the level each object sits on: `Rvt:Element:Level`
// is an entity value naming another object, and 17,106 objects on Snowdon carry one. That is a
// recorded storey link, so it is read as one, and the sheet says which way found it.
//
// It lives in this demo directory because the Inspect chapter has no shared module of its own:
// `demos/src/demos/_shared` belongs to Track GAL. Moving it there is a request in CHECKPOINT-D1.md;
// the other three demos import it from here until that happens.
//
// The index of the open model is built once and held. A demo's inspector runs after every change
// event and cannot walk half a million instance rows again; disposing the demo forgets it, so the
// page does not keep a hundred megabytes of model alive behind a gallery it has left.

import {
  boundsCenter,
  emptyBounds,
  emptyInstances,
  emptyModel,
  expandBounds,
  f64Column,
  failure,
  indexFacts,
  instanceTransform,
  isEmptyBounds,
  meshBoundsAt,
  modelKey,
  noMesh,
  objectKey,
  stringColumn,
  styleRule,
  success,
  table,
  transformBounds,
  transformPoint,
  unionBounds,
  type Bounds,
  type Fact,
  type FactIndex,
  type Geometry,
  type ModelData,
  type ObjectKey,
  type ObjectRecord,
  type Result,
  type Session,
  type StyleRule,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  documentOfObject,
  noModelProperties,
  objectProperties,
  propertyCount,
  propertyRowEnd,
  propertyRowStart,
  propertyValue,
  type ModelDocuments,
  type ModelProperties,
  type PropertyReading,
} from '@bim-open-toolkit/formats';
import {
  defaultBuildingOptions,
  generateBuilding,
  type Building,
  type BuildingOptions,
} from '@bim-open-toolkit/synthetic';

// The options the generated building is made with. They are the generator's own defaults, which is
// what `_shared/snowdon.ts` generates the second fixture with; the two must agree, because the facts
// held here are matched to that model by its reference and its object ids.
export const inspectBuildingOptions: BuildingOptions = defaultBuildingOptions;

// One storey and everything that belongs to it.
export type Storey = {
  readonly key: ObjectKey;
  readonly objectId: string;
  readonly name: string;
  readonly members: readonly ObjectKey[];
  readonly bounds: Bounds;
};

// How a storey link was found, worded to finish the sentence "found by". A parent link is the model
// saying so directly, a recorded level is the `Rvt:Element:Level` property naming the level object,
// and a storey object is on itself. All three are recorded, none is guessed, and the sheet names
// which one answered so a reader can check it rather than trusting the row.
export type StoreyLink = 'a parent link' | 'the level it records' | 'being a storey itself';

// The storey an object sits on and what said so.
export type StoreyOfObject = { readonly key: ObjectKey; readonly name: string | undefined; readonly via: StoreyLink };

// The source document an object came from, as the file names it.
export type SourceDocument = { readonly title: string | undefined; readonly path: string | undefined };

// What the loader decoded of what the file records, when it was asked for it and the file carries
// it. A generated model and a format that carries neither pass nothing and read as empty.
export type RecordedTables = {
  readonly properties?: ModelProperties | undefined;
  readonly documents?: ModelDocuments | undefined;
};

// A model that names no source documents.
export const noModelDocuments: ModelDocuments = { count: 0, title: [], path: [], ofObject: new Int32Array(0) };

// One open model with the lookups the demos read. Every map is addressed by object key, which is
// what sets, style rules and picks all speak.
export type InspectIndex = {
  readonly model: ModelData;
  readonly geometry: Geometry;
  // Object keys in the order `ModelData.objects` holds them.
  readonly keys: readonly ObjectKey[];
  readonly records: ReadonlyMap<ObjectKey, ObjectRecord>;
  // The object row of each key, which is what the property and document columns are addressed by.
  readonly rowOf: ReadonlyMap<ObjectKey, number>;
  // Every fact recorded about this model, in the order it was recorded. Empty for a loaded model.
  readonly recorded: readonly Fact[];
  readonly facts: FactIndex;
  // The parameter tables the file records, empty when it records none or none were asked for.
  readonly properties: ModelProperties;
  // The source documents the file names, empty when it names none.
  readonly documents: ModelDocuments;
  // The box an object occupies, or the point it sits at when it draws nothing.
  readonly bounds: ReadonlyMap<ObjectKey, Bounds>;
  // The storey an object belongs to, absent when nothing links it to one.
  readonly storeyOf: ReadonlyMap<ObjectKey, ObjectKey>;
  // What found each of those links.
  readonly storeyVia: ReadonlyMap<ObjectKey, StoreyLink>;
  readonly storeys: readonly Storey[];
};

// A command a demo dispatches, as plain data, so an opening sequence can be read and tested before
// anything is drawn.
export type CommandCall = { readonly command: string; readonly input: unknown };

// The name the generator records a door's nominal and clear width and fire rating under.
export const doorFactNames: readonly string[] = ['nominalWidth', 'clearWidth', 'fireRating'];

// The categories an object that stands between a viewer and the doors is recorded under, compared
// without case: the generator writes `Wall`, a Revit export writes `Walls`.
export const enclosureCategories: ReadonlySet<string> = new Set(['wall', 'walls']);

// The categories a storey is recorded under, compared without case. The same set `features` matches
// in `levelsOf`, so one convention answers the question everywhere: Revit writes the plural and IFC
// the singular, and both are listed as themselves rather than matched by a rule loose enough to turn
// names that mean something else into names in this set.
const storeyCategories: ReadonlySet<string> = new Set([
  'storey',
  'storeys',
  'story',
  'stories',
  'level',
  'levels',
  'floor level',
  'floor levels',
  'building storey',
  'building storeys',
  'buildingstorey',
  'ifcbuildingstorey',
]);

// The name the BOS exporter records an object's level under. It is an entity value, so it names
// another object of the same model rather than a string somebody typed.
export const levelPropertyName = 'Rvt:Element:Level';

// True when the record is one of the categories, whatever case the model wrote it in.
const inCategories = (categories: ReadonlySet<string>, record: ObjectRecord | undefined): boolean =>
  categories.has((record?.category ?? '').trim().toLowerCase());

const objectRowsByObjectId = (model: ModelData): ReadonlyMap<string, ObjectRecord> =>
  new Map(model.objects.map((record) => [record.ref.objectId, record]));

// The storey a record belongs to, found by walking parent links. The walk is bounded by the number
// of objects, so a cycle in the data cannot hang the gallery. A model that records no parent link -
// which is every model the loaders produce today - links nothing to a storey, and that is the
// answer, not a reason to guess one from an elevation.
const storeyIdOf = (
  byObjectId: ReadonlyMap<string, ObjectRecord>,
  record: ObjectRecord,
  limit: number,
): string | undefined => {
  let current: ObjectRecord | undefined = record;
  for (let step = 0; step < limit && current !== undefined; step += 1) {
    if (inCategories(storeyCategories, current)) return current.ref.objectId;
    const parentId: string | undefined = current.parentId;
    current = parentId === undefined ? undefined : byObjectId.get(parentId);
  }
  return undefined;
};

// The box of one mesh. A geometry carries its meshes as records, as a `MeshTable`, or as both; a
// BFAST carries only the table, so the table is read whenever the record list is empty.
const meshBounds = (geometry: Geometry, index: number): Bounds => {
  const record = geometry.meshes[index];
  if (record !== undefined) return record.bounds;
  return geometry.meshTable === undefined ? emptyBounds : meshBoundsAt(geometry.meshTable, index);
};

// The box each object occupies, unioned over every instance row that draws it. An object that draws
// nothing gets the point its transform places it at, which is where a tag anchors.
const boundsByKey = (model: ModelData, geometry: Geometry): ReadonlyMap<ObjectKey, Bounds> => {
  const boxes = model.objects.map(() => emptyBounds);
  const instances = geometry.instances;
  for (let row = 0; row < instances.count; row += 1) {
    const meshIndex = instances.meshIndex[row] ?? noMesh;
    const objectIndex = instances.objectIndex[row] ?? -1;
    const held = boxes[objectIndex];
    if (meshIndex === noMesh || held === undefined) continue;
    boxes[objectIndex] = unionBounds(held, transformBounds(instanceTransform(instances, row), meshBounds(geometry, meshIndex)));
  }
  return new Map(
    model.objects.map((record, index) => {
      const box = boxes[index] ?? emptyBounds;
      const origin: Vec3 = transformPoint(record.transform, [0, 0, 0]);
      return [objectKey(record.ref), isEmptyBounds(box) ? expandBounds(emptyBounds, origin) : box];
    }),
  );
};

// The members of each storey, in one pass, so a model with many storeys costs no more than a model
// with three.
const membersByStorey = (storeyOf: ReadonlyMap<ObjectKey, ObjectKey>): ReadonlyMap<ObjectKey, readonly ObjectKey[]> => {
  const grouped = new Map<ObjectKey, ObjectKey[]>();
  for (const [member, storey] of storeyOf) {
    const held = grouped.get(storey);
    if (held === undefined) grouped.set(storey, [member]);
    else held.push(member);
  }
  return grouped;
};

const storeysOf = (
  model: ModelData,
  storeyOf: ReadonlyMap<ObjectKey, ObjectKey>,
  bounds: ReadonlyMap<ObjectKey, Bounds>,
): readonly Storey[] => {
  const grouped = membersByStorey(storeyOf);
  return model.objects
    .filter((record) => inCategories(storeyCategories, record))
    .map((record) => {
      const key = objectKey(record.ref);
      const members = grouped.get(key) ?? [];
      const box = members.reduce(
        (whole, member) => unionBounds(whole, bounds.get(member) ?? emptyBounds),
        bounds.get(key) ?? emptyBounds,
      );
      return { key, objectId: record.ref.objectId, name: record.name ?? record.ref.objectId, members, bounds: box };
    });
};

// The object each object records as its level, read once over the parameter columns rather than
// per object later. Only the object's own rows are scanned - a few dozen each, not the whole table -
// and only the descriptors named `Rvt:Element:Level`, so a file that records no such property costs
// one map lookup and nothing else. An object naming itself is not a link and is left out.
const levelRowOf = (properties: ModelProperties): ReadonlyMap<number, number> => {
  const found = new Map<number, number>();
  const wanted = properties.descriptors.byName.get(levelPropertyName);
  if (wanted === undefined || wanted.length === 0) return found;
  const set = new Set(wanted);
  for (let object = 0; object < properties.objects; object += 1) {
    const end = propertyRowEnd(properties, object);
    for (let row = propertyRowStart(properties, object); row < end; row += 1) {
      if (!set.has(properties.descriptor[row] ?? -1)) continue;
      const target = propertyValue(properties, row);
      if (typeof target === 'number' && target >= 0 && target !== object) found.set(object, target);
      break;
    }
  }
  return found;
};

const buildIndex = (
  model: ModelData,
  geometry: Geometry,
  recorded: readonly Fact[],
  tables: RecordedTables,
): InspectIndex => {
  const properties = tables.properties ?? noModelProperties;
  const documents = tables.documents ?? noModelDocuments;
  const byObjectId = objectRowsByObjectId(model);
  const limit = model.objects.length + 1;
  const storeyOf = new Map<ObjectKey, ObjectKey>();
  const storeyVia = new Map<ObjectKey, StoreyLink>();
  for (const record of model.objects) {
    const storeyId = storeyIdOf(byObjectId, record, limit);
    const storey = storeyId === undefined ? undefined : byObjectId.get(storeyId);
    if (storey === undefined) continue;
    storeyOf.set(objectKey(record.ref), objectKey(storey.ref));
    storeyVia.set(objectKey(record.ref), storeyId === record.ref.objectId ? 'being a storey itself' : 'a parent link');
  }
  for (const [objectRow, levelRow] of levelRowOf(properties)) {
    const record = model.objects[objectRow];
    const level = model.objects[levelRow];
    if (record === undefined || level === undefined) continue;
    const key = objectKey(record.ref);
    if (storeyOf.has(key)) continue;
    storeyOf.set(key, objectKey(level.ref));
    storeyVia.set(key, 'the level it records');
  }
  const bounds = boundsByKey(model, geometry);
  return {
    model,
    geometry,
    keys: model.objects.map((record) => objectKey(record.ref)),
    records: new Map(model.objects.map((record) => [objectKey(record.ref), record])),
    rowOf: new Map(model.objects.map((record, row) => [objectKey(record.ref), row])),
    recorded,
    facts: indexFacts(recorded),
    properties,
    documents,
    bounds,
    storeyOf,
    storeyVia,
    storeys: storeysOf(model, storeyOf, bounds),
  };
};

let building: Building | undefined;

// The generated building, made once and kept. Generation is deterministic, so the model this holds
// is the same model `_shared/snowdon.ts` hands the viewer as the second fixture, object for object.
const generatedBuilding = (): Building => {
  const already = building;
  if (already !== undefined) return already;
  const made = generateBuilding(inspectBuildingOptions);
  building = made;
  return made;
};

// What is recorded about a model, which is nothing unless it is the building generated here. No
// format the loaders read carries observations, so a loaded model has no facts; reporting none is
// the honest answer and the demo shows it as one.
export const factsFor = (model: ModelData): readonly Fact[] =>
  modelKey(model.ref) === modelKey(generatedBuilding().model.ref) ? generatedBuilding().facts : [];

// The lookups for one opened model, with whatever the loader read of what the file records.
export const inspectIndexOf = (model: ModelData, geometry: Geometry, tables: RecordedTables = {}): InspectIndex =>
  buildIndex(model, geometry, factsFor(model), tables);

let syntheticHeld: InspectIndex | undefined;

// The generated building's own index. It is what the tests read, and what the demo holds when the
// generated fixture is the one chosen.
export const syntheticIndex = (): InspectIndex => {
  const already = syntheticHeld;
  if (already !== undefined) return already;
  const made = inspectIndexOf(generatedBuilding().model, generatedBuilding().geometry);
  syntheticHeld = made;
  return made;
};

// No model open: every lookup empty, so a reader that runs before a fixture is opened reads nothing
// rather than reading a model the viewer is not showing.
const noModelIndex: InspectIndex = buildIndex(
  emptyModel({ id: 'none', revision: '0' }, { units: 'unknown', up: 'z', registration: { kind: 'unknown' } }),
  { meshes: [], instances: emptyInstances(0) },
  [],
  {},
);

let held: InspectIndex | undefined;

// Says which model the demo is reading. The demo calls it as it starts, with what the viewer opened,
// and again with nothing as it is disposed.
export const useInspectIndex = (index: InspectIndex | undefined): void => {
  held = index;
};

// The model the demo is reading, or the empty index while none is open.
export const inspectIndex = (): InspectIndex => held ?? noModelIndex;

// The objects of one category, in model order.
export const keysOfCategory = (index: InspectIndex, category: string): readonly ObjectKey[] =>
  index.keys.filter((key) => index.records.get(key)?.category === category);

// The walls, which are what hides the doors. A model that records no category has none, and the rule
// below then hides nothing, which is what that model earns.
export const wallKeys = (index: InspectIndex): readonly ObjectKey[] =>
  index.keys.filter((key) => inCategories(enclosureCategories, index.records.get(key)));

// The id of the rule that takes the walls away.
export const hideWallsRuleId = 'inspect/hide-walls';

// Takes the walls away so the doors inside them can be seen. Hiding rather than ghosting, because a
// wall drawn at low opacity still writes depth and hides the leaf behind it.
export const hideWallsRule = (index: InspectIndex): StyleRule =>
  styleRule(hideWallsRuleId, 'Walls hidden so the doors show', wallKeys(index), { visible: false }, 10);

// The centre of an object's box, or undefined when nothing is known about where it is.
export const centreOf = (index: InspectIndex, key: ObjectKey): Vec3 | undefined => {
  const box = index.bounds.get(key);
  return box === undefined ? undefined : boundsCenter(box);
};

// The storey an object belongs to and what said so, or undefined when nothing links it to one. A
// room whose storey link was lost reads as undefined rather than as a guessed level.
export const storeyOfObject = (index: InspectIndex, key: ObjectKey): StoreyOfObject | undefined => {
  const storey = index.storeyOf.get(key);
  const via = index.storeyVia.get(key);
  if (storey === undefined || via === undefined) return undefined;
  return { key: storey, name: index.records.get(storey)?.name, via };
};

// The name of the storey an object belongs to, or undefined when nothing links it to one.
export const storeyNameOf = (index: InspectIndex, key: ObjectKey): string | undefined =>
  storeyOfObject(index, key)?.name;

// The source document an object came from, or undefined when the file names none for it. On a
// federated model this is which of the discipline files the object was exported from.
export const documentOf = (index: InspectIndex, key: ObjectKey): SourceDocument | undefined => {
  const row = index.rowOf.get(key);
  if (row === undefined || index.documents.count === 0) return undefined;
  const document = documentOfObject(index.documents, row);
  if (document < 0) return undefined;
  return { title: index.documents.title[document], path: index.documents.path[document] };
};

// Every property the file records about one object, resolved, in the order the file records them.
// Only that object's own rows are read - between three and a hundred and twenty on Snowdon - which
// is why the row range is held here and not looked up again in the table.
export const propertiesOf = (index: InspectIndex, key: ObjectKey): readonly PropertyReading[] => {
  const row = index.rowOf.get(key);
  return row === undefined ? [] : objectProperties(index.properties, row);
};

// How many properties the file records about one object, without resolving any of them.
export const propertyCountOf = (index: InspectIndex, key: ObjectKey): number => {
  const row = index.rowOf.get(key);
  return row === undefined ? 0 : propertyCount(index.properties, row);
};

// Every fact recorded about an object, in the order they were recorded.
export const factsOf = (index: InspectIndex, key: ObjectKey): readonly Fact[] => [
  ...(index.facts.get(key)?.values() ?? []),
];

// The known nominal width of a door in millimetres, or NaN when it was never recorded or the
// sources disagree. NaN rather than zero, so a colouring paints it as missing instead of as narrow.
export const nominalWidthMm = (index: InspectIndex, key: ObjectKey): number => {
  const observation = index.facts.get(key)?.get('nominalWidth')?.observation;
  if (observation === undefined || observation.kind !== 'known') return Number.NaN;
  return observation.value.kind === 'quantity' ? observation.value.quantity.value : Number.NaN;
};

// The columns a colouring reads: one row per object, addressed by object key. A value nobody
// recorded is the empty string or NaN, never a substitute.
export const objectTable = (index: InspectIndex): Table =>
  table([
    ['key', stringColumn([...index.keys])],
    ['objectId', stringColumn(index.keys.map((key) => index.records.get(key)?.ref.objectId ?? ''))],
    ['category', stringColumn(index.keys.map((key) => index.records.get(key)?.category ?? ''))],
    ['name', stringColumn(index.keys.map((key) => index.records.get(key)?.name ?? ''))],
    ['storey', stringColumn(index.keys.map((key) => storeyNameOf(index, key) ?? ''))],
    ['nominalWidthMm', f64Column(index.keys.map((key) => nominalWidthMm(index, key)))],
  ]);

// Runs a sequence of commands, stopping at the first one the session refuses.
export const runCalls = (session: Session, calls: readonly CommandCall[]): Result<number> => {
  for (const call of calls) {
    const result = session.dispatch(call.command, call.input);
    if (!result.ok) return failure(result.diagnostics);
  }
  return success(calls.length);
};
