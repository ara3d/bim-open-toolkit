// The default composition's own features: which models are open, where each view is looking, and
// what colour everything is.
//
// These are features like any other - an id, a slice, commands, no privileged access - so a host
// that wants richer ones from `@bim-open-toolkit/features` passes its own list to `createViewer`.
// They are here because the beginner path needs them: without a camera command there is nothing to
// run on line three, and without an appearance slice a saved scene restores nothing worth looking
// at.
//
// Every command reaches the renderer through `viewerAccess`, and reports `viewer/no-scene` rather
// than failing silently when there is none, which is what lets the whole set be tested in Node
// against a session with no canvas.

import {
  array,
  boolean,
  command,
  diagnostic,
  failure,
  feature,
  frameBounds,
  isEmptyBounds,
  literal,
  modelRefSchema,
  nullable,
  number,
  object,
  optional,
  record,
  setOf,
  stateSlice,
  string,
  success,
  union,
  viewDirection,
  type AnyFeature,
  type ObjectKey,
  type Result,
  type Session,
  type StyleRule,
} from '@bim-open-toolkit/model';
import { navModes, type NavMode } from '@bim-open-toolkit/interact';
import { viewerAccess, type ViewerAccess } from './access.js';
import { styleRuleSchema, viewStateSchema } from './schemas.js';

const navModeSchema = union<NavMode>(literal('orbit'), literal('first-person'), literal('overhead'));

// Which models are open. A document carries this so a host can reopen what a scene was about.
export const modelsSlice = stateSlice('viewer.models', 1, object({ open: array(modelRefSchema) }), { open: [] });

// Where each view is looking, by view id, and how the views navigate.
export const viewSlice = stateSlice(
  'viewer.view',
  1,
  object({ cameras: record(viewStateSchema), mode: navModeSchema, linked: boolean() }),
  { cameras: {}, mode: 'orbit', linked: false },
);

// What everything is coloured: the ordered rules, what is selected, and the filter.
export const appearanceSlice = stateSlice(
  'viewer.appearance',
  1,
  object({ rules: array(styleRuleSchema), selection: array(string()), filter: nullable(array(string())) }),
  { rules: [], selection: [], filter: null },
);

const noScene = (what: string): Result<unknown> =>
  failure([diagnostic('viewer/no-scene', `${what} needs a view; this session has none.`, ['view'])]);

// The view a command means: the one it names, or the first one there is.
const viewOf = (reach: ViewerAccess, named: string | undefined): string | undefined => named ?? reach.views.ids()[0];

const reachOf = (session: Session): ViewerAccess | undefined => viewerAccess.get(session);

// Moves a view's camera so a box fills the picture: everything, or just the objects named.
const fitCommand = command({
  name: 'view.fit',
  title: 'Fit',
  description: 'Moves the camera so the model, or the objects named, fills the picture.',
  input: object({ view: optional(string()), keys: optional(array(string())), flightMs: optional(number()) }),
  run: (session, input) => {
    const reach = reachOf(session);
    if (reach === undefined) return noScene('Fitting the view');
    const id = viewOf(reach, input.view);
    const current = id === undefined ? undefined : reach.views.camera(id);
    if (id === undefined || current === undefined) return noScene('Fitting the view');
    const keys = input.keys ?? [];
    const bounds = keys.length === 0 ? reach.scene.bounds() : reach.scene.boundsOf(setOf(keys));
    if (isEmptyBounds(bounds))
      return failure([diagnostic('viewer/nothing-to-fit', 'There is nothing with bounds to fit.', ['keys'])]);
    const framed = frameBounds(
      bounds,
      viewDirection(current.camera),
      current.projection,
      reach.views.aspect(id),
      current.camera.up,
    );
    if (framed === undefined)
      return failure([diagnostic('viewer/nothing-to-fit', 'The bounds could not be framed.', ['keys'])]);
    reach.views.setCamera(id, { ...framed, coordinates: current.coordinates }, input.flightMs);
    return success(id);
  },
});

// Puts a view's camera exactly where it is told, which is what restoring a saved view does.
const lookCommand = command({
  name: 'view.look',
  title: 'Look',
  description: 'Puts a view exactly at the camera pose and projection given.',
  input: object({ view: optional(string()), camera: viewStateSchema, flightMs: optional(number()) }),
  run: (session, input) => {
    const reach = reachOf(session);
    if (reach === undefined) return noScene('Moving the view');
    const id = viewOf(reach, input.view);
    if (id === undefined) return noScene('Moving the view');
    return reach.views.setCamera(id, input.camera, input.flightMs)
      ? success(id)
      : failure([diagnostic('viewer/no-view', `There is no view called ${id}.`, ['view'])]);
  },
});

// Switches every view between orbiting, walking and looking straight down.
const modeCommand = command({
  name: 'view.mode',
  title: 'Navigation mode',
  description: `How the views respond to input: ${navModes.join(', ')}.`,
  input: object({ mode: navModeSchema }),
  run: (session, input) => {
    session.write(viewSlice, { ...session.read(viewSlice), mode: input.mode });
    reachOf(session)?.views.setMode(input.mode);
    return success(input.mode);
  },
});

// Links the views, so moving one moves the others. Two views of one model side by side is why this
// is composition and not something a single view could own.
const linkCommand = command({
  name: 'view.link',
  title: 'Link views',
  description: 'Moves every view together, or lets each move on its own.',
  input: object({ linked: boolean() }),
  run: (session, input) => {
    session.write(viewSlice, { ...session.read(viewSlice), linked: input.linked });
    return success(input.linked);
  },
});

// Replaces the whole ordered rule list.
const rulesCommand = command({
  name: 'appearance.rules',
  title: 'Set colour rules',
  description: 'Replaces the ordered list of colour rules.',
  input: object({ rules: array(styleRuleSchema) }),
  run: (session, input) => {
    session.write(appearanceSlice, { ...session.read(appearanceSlice), rules: input.rules });
    return success(input.rules.length);
  },
});

// Adds one rule, or replaces the one with its id, keeping the order.
const putRuleCommand = command({
  name: 'appearance.rule',
  title: 'Add or replace a colour rule',
  description: 'Adds a rule, or replaces the one that already has its id.',
  input: object({ rule: styleRuleSchema }),
  run: (session, input) => {
    const held = session.read(appearanceSlice);
    const at = held.rules.findIndex((one) => one.id === input.rule.id);
    const rules: readonly StyleRule[] =
      at === -1 ? [...held.rules, input.rule] : held.rules.map((one, index) => (index === at ? input.rule : one));
    session.write(appearanceSlice, { ...held, rules });
    return success(input.rule.id);
  },
});

// Takes a rule away by id.
const removeRuleCommand = command({
  name: 'appearance.removeRule',
  title: 'Remove a colour rule',
  description: 'Takes a colour rule away by its id.',
  input: object({ id: string() }),
  run: (session, input) => {
    const held = session.read(appearanceSlice);
    const rules = held.rules.filter((one) => one.id !== input.id);
    session.write(appearanceSlice, { ...held, rules });
    return success(held.rules.length - rules.length);
  },
});

// Marks objects. A selection never brings back geometry a rule, a filter or an edit removed.
const selectCommand = command({
  name: 'appearance.select',
  title: 'Select',
  description: 'Marks the objects named, replacing whatever was selected.',
  input: object({ keys: array(string()) }),
  run: (session, input) => {
    const selection: readonly ObjectKey[] = input.keys;
    session.write(appearanceSlice, { ...session.read(appearanceSlice), selection });
    return success(selection.length);
  },
});

// Shows only the objects named, or everything again when given nothing.
const filterCommand = command({
  name: 'appearance.filter',
  title: 'Filter',
  description: 'Shows only the objects named. Passing null shows everything again.',
  input: object({ keys: nullable(array(string())) }),
  run: (session, input) => {
    session.write(appearanceSlice, { ...session.read(appearanceSlice), filter: input.keys });
    return success(input.keys === null ? 0 : input.keys.length);
  },
});

// Puts the model back the colour it was loaded with.
const clearCommand = command({
  name: 'appearance.clear',
  title: 'Clear appearance',
  description: 'Removes every rule, the selection and the filter.',
  input: object({}),
  run: (session) => {
    session.write(appearanceSlice, { rules: [], selection: [], filter: null });
    return success(true);
  },
});

// The models a session has open, as data a document can carry.
export const modelsFeature: AnyFeature = feature('viewer.models', modelsSlice);

// Where each view looks, and how the views navigate.
export const viewFeature: AnyFeature = feature('viewer.view', viewSlice, [
  fitCommand,
  lookCommand,
  modeCommand,
  linkCommand,
]);

// Colour rules, selection and filter.
export const appearanceFeature: AnyFeature = feature('viewer.appearance', appearanceSlice, [
  rulesCommand,
  putRuleCommand,
  removeRuleCommand,
  selectCommand,
  filterCommand,
  clearCommand,
]);

// What `createViewer` installs when it is told nothing else.
export const defaultFeatures = (): readonly AnyFeature[] => [modelsFeature, viewFeature, appearanceFeature];
