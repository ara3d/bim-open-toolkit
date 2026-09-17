// A seeded procurement record: delivery, acceptance and installation events with dates and gaps.
//
// The point of this data is that the three states stay apart. An item that was accepted must not
// read as installed, an item nobody has recorded anything about must not read as delivered, and a
// date two sources disagree about must not be averaged into a plausible single date. So the
// generator produces items with events missing in the middle, items with no events at all, dates
// nobody wrote down, dates two sources dispute, and events dated after the as-of date, which are
// normal rather than exceptional.
//
// The module is named `deliveries` because `schedule.ts` already holds the helper that turns
// observations into schedule columns. The fixture catalog still calls this generator `schedule`,
// which is the name the V2 plan's synthetic data catalog gives it.

import {
  conflicting,
  coverageOf,
  known,
  metresZUpLocal,
  missing,
  stringColumn,
  table,
  text,
  translation,
  type Appearance,
  type Coverage,
  type Evidence,
  type Geometry,
  type ModelData,
  type ModelRef,
  type Observation,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { cursor as newCursor, drawChance, drawFloat, drawInt, drawPick, type Cursor } from './cursor.js';
import { addDays, type IsoDate } from './dates.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { box } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';
import { textColumns, type NamedColumn } from './schedule.js';

// The three states a procured item passes through, in the order a timeline ranks them.
export const eventTypes = ['delivered', 'accepted', 'installed'] as const;

// One of the three procurement states.
export type EventType = (typeof eventTypes)[number];

// What to generate. Dates are `YYYY-MM-DD`; `asOfDate` is the day the timeline is read on.
export type DeliveryOptions = {
  readonly seed: number;
  readonly items: number;
  readonly startDate: IsoDate;
  readonly asOfDate: IsoDate;
  readonly gapScale: number;
};

// Two dozen items across a procurement window that runs past the as-of date, so some events are
// still in the future when the timeline is read, which is normal rather than exceptional.
export const defaultDeliveryOptions: DeliveryOptions = {
  seed: 5,
  items: 24,
  startDate: '2026-01-05',
  asOfDate: '2026-06-01',
  gapScale: 1,
};

// A generated procurement record: the items, their events and the geometry of the laydown area.
export type DeliverySchedule = {
  readonly options: DeliveryOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly objects: Table;
  readonly events: Table;
  readonly asOfDate: IsoDate;
  readonly dateCoverage: Coverage;
};

// Rejects options that cannot produce a schedule.
function checkOptions(options: DeliveryOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.items) || options.items < 1) throw new Error(`items must be a positive integer, got ${options.items}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
  if (!(options.startDate < options.asOfDate)) throw new Error(`startDate must fall before asOfDate, got ${options.startDate} and ${options.asOfDate}`);
}

// What an item is.
const categories = ['Pump', 'Air handling unit', 'Chiller', 'Fan coil unit', 'Valve set', 'Distribution panel'] as const;

// The evidence a delivery note provides.
const deliveryNote: Evidence = { source: 'delivery-note', reference: 'GRN-2026' };

// The evidence a site inspection provides.
const inspection: Evidence = { source: 'site-inspection', reference: 'QA-2026' };

// The evidence the installation record provides.
const installationRecord: Evidence = { source: 'installation-record', reference: 'INST-2026' };

// The evidence behind each state.
const evidenceOf: Readonly<Record<EventType, Evidence>> = {
  delivered: deliveryNote,
  accepted: inspection,
  installed: installationRecord,
};

// One recorded event: it happened, whatever anybody wrote down about when.
type Event = {
  readonly id: string;
  readonly objectId: string;
  readonly eventType: EventType;
  readonly date: Observation;
};

// One procured item.
type Item = {
  readonly objectId: string;
  readonly name: string;
  readonly category: string;
  readonly position: Vec3;
};

// The appearance of a crate in the laydown area. States are a rule the viewer applies, not a colour
// baked into the data.
const itemAppearance: Appearance = { color: [0.72, 0.68, 0.6], opacity: 1, visible: true };

// What was written down about the date of an event that did happen. Most are recorded; a few were
// never written down, and a few are disputed between the paperwork and the site record.
function drawDate(target: Cursor, date: IsoDate, eventType: EventType, gap: number): Observation {
  const evidence = evidenceOf[eventType];
  const roll = drawFloat(target);
  if (roll < 0.07 * gap) {
    return conflicting([text(date), text(addDays(date, 3))], [evidence, inspection]);
  }
  if (roll < 0.13 * gap) return missing('not-provided', [evidence]);
  return known(text(date), [evidence]);
}

// Generates a procurement record from its options. The same options always give the same record.
export function generateDeliverySchedule(options: DeliveryOptions): DeliverySchedule {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;
  const ref: ModelRef = { id: 'synthetic-deliveries', revision: `seed-${options.seed}`, source: 'generated' };
  const meshes: readonly ShadedMesh[] = [box([1.2, 1, 0.9])];
  const meshNames: readonly string[] = ['delivery-item'];

  const items: Item[] = [];
  const events: Event[] = [];
  const columns = Math.ceil(Math.sqrt(options.items));

  for (let index = 0; index < options.items; index++) {
    const objectId = `EQ-${index + 1}`;
    const category = drawPick(cursor, categories);
    items.push({
      objectId,
      name: `${category} ${String(index + 1).padStart(2, '0')}`,
      category,
      position: [(index % columns) * 2.4, Math.floor(index / columns) * 2.4, 0.5],
    });

    // Every draw is made for every item, so changing one rate never shifts the sequence for
    // another. An item with no events at all is a real state: nobody has recorded anything yet.
    const untracked = drawChance(cursor, 0.06 * gap);
    const delivered = drawChance(cursor, 0.9);
    const accepted = drawChance(cursor, 0.75);
    const installed = drawChance(cursor, 0.55);
    const deliveryDay = drawInt(cursor, 0, 170);
    const acceptanceLag = drawInt(cursor, 3, 21);
    const installationLag = drawInt(cursor, 5, 41);

    const deliveryDate = addDays(options.startDate, deliveryDay);
    const acceptanceDate = addDays(deliveryDate, acceptanceLag);
    const installationDate = addDays(acceptanceDate, installationLag);
    const dates: Readonly<Record<EventType, IsoDate>> = {
      delivered: deliveryDate,
      accepted: acceptanceDate,
      installed: installationDate,
    };
    const present: Readonly<Record<EventType, boolean>> = { delivered, accepted, installed };

    for (const eventType of eventTypes) {
      // The draw is made whether or not the event exists, so an absent event does not shift the
      // sequence for the ones that follow it.
      const observation = drawDate(cursor, dates[eventType], eventType, gap);
      if (untracked || !present[eventType]) continue;
      events.push({ id: `evt-${events.length + 1}`, objectId, eventType, date: observation });
    }
  }

  const target = sceneBuilder(ref);
  for (const item of items) {
    add(target, {
      objectId: item.objectId,
      name: item.name,
      category: item.category,
      transform: translation(item.position),
      appearance: itemAppearance,
      meshIndex: 0,
    });
  }
  const built = scene(target, metresZUpLocal, meshes, meshNames);

  const eventColumns: readonly NamedColumn[] = [
    ['id', stringColumn(events.map((event) => event.id))],
    ['objectId', stringColumn(events.map((event) => event.objectId))],
    ['eventType', stringColumn(events.map((event) => event.eventType))],
    ...textColumns('date', events.map((event) => event.date)),
  ];

  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    objects: table([
      ['objectId', stringColumn(items.map((item) => item.objectId))],
      ['name', stringColumn(items.map((item) => item.name))],
      ['category', stringColumn(items.map((item) => item.category))],
    ]),
    events: table(eventColumns),
    asOfDate: options.asOfDate,
    dateCoverage: coverageOf(events.map((event) => event.date)),
  };
}
