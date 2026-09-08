// Show me only level 2, only this room, only the doors.
//
// The building with its roof and ceilings, three pickers over the groups the model itself offers,
// and one mode that says what happens to everything else. A choice replaces the last one, so the
// page never shows two answers at once, and the count in the status line is composed from the sets
// and appearance slices rather than read off the renderer.

import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { failure, success } from '@bim-open-toolkit/model';
import {
  appearanceFeatureFor,
  editsFeature,
  levelsOf,
  navigationAidsFeature,
  navigationHook,
  sceneRenderTarget,
  setsFeature,
} from '@bim-open-toolkit/features';
import { addButton, addSelect, addStatus, type Choice } from '../_shared/controls.js';
import { mountFeatureDemo } from '../_shared/page.js';
import {
  findGroup,
  groupKinds,
  groupsOf,
  groupsOfKind,
  placesOf,
  type GroupKind,
  type ObjectGroup,
} from './groups.js';
import { applyShow, clearShow, isShowMode, showModes, shownObjects, type ShowMode } from './show.js';

// What each picker's empty choice says, and what each is labelled.
const pickers: readonly { readonly kind: GroupKind; readonly label: string; readonly all: string }[] = [
  { kind: 'storey', label: 'Storey', all: 'All storeys' },
  { kind: 'room', label: 'Room', all: 'All rooms' },
  { kind: 'category', label: 'Category', all: 'All categories' },
];

// What each mode is called on the page.
const modeLabels: Readonly<Record<ShowMode, string>> = {
  isolate: 'Isolate it',
  ghost: 'Ghost everything else',
  hide: 'Hide it',
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isGroupKind = (value: unknown): value is GroupKind =>
  typeof value === 'string' && groupKinds.some((kind) => kind === value);

// What `act('show', input)` was asked for, or undefined when the input is not that.
const showAction = (
  input: unknown,
): { readonly kind: GroupKind; readonly id: string; readonly mode: ShowMode | undefined } | undefined => {
  if (!isRecord(input)) return undefined;
  const by = input['by'];
  const id = input['id'];
  const mode = input['mode'];
  if (!isGroupKind(by) || typeof id !== 'string') return undefined;
  if (mode !== undefined && (typeof mode !== 'string' || !isShowMode(mode))) return undefined;
  return { kind: by, id, mode: typeof mode === 'string' && isShowMode(mode) ? mode : undefined };
};

const messagesOf = (diagnostics: readonly { readonly message: string }[]): string =>
  diagnostics.map((item) => item.message).join('; ');

void mountFeatureDemo((host, page) => {
  const building = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
  const opened = host.open('building', building.model, building.geometry);
  if (!opened.ok) return failure(opened.diagnostics);
  const model = opened.value;
  const installed = host.features.install([
    editsFeature,
    setsFeature,
    appearanceFeatureFor(sceneRenderTarget(host.binding), model.base),
    { ...navigationAidsFeature, install: navigationHook({ setView: host.setView }) },
  ]);
  if (!installed.ok) return failure(installed.diagnostics);

  const groups = groupsOf(model.model);
  const places = placesOf(model.model);
  const levels = levelsOf(model.model);
  let chosen: { readonly kind: GroupKind; readonly id: string } | undefined;
  let mode: ShowMode = 'isolate';
  let picked = '';
  let problem = '';

  const chosenGroup = (): ObjectGroup | undefined =>
    chosen === undefined ? undefined : findGroup(groups, chosen.kind, chosen.id);

  const choicesOf = (kind: GroupKind, all: string): readonly Choice[] => [
    { value: '', label: all },
    ...groupsOfKind(groups, kind).map((group) => ({ value: group.id, label: `${group.label} (${group.count})` })),
  ];

  const readout = addStatus(page.controls, 'readout', 'Click an object to read where it sits.');
  const selects = new Map<GroupKind, HTMLSelectElement>(
    pickers.map((picker): [GroupKind, HTMLSelectElement] => [
      picker.kind,
      addSelect(page.controls, picker.kind, picker.label, choicesOf(picker.kind, picker.all), (value) => {
        chosen = value === '' ? undefined : { kind: picker.kind, id: value };
        apply();
      }),
    ]),
  );
  const modeSelect = addSelect(
    page.controls,
    'mode',
    'Mode',
    showModes.map((name) => ({ value: name, label: modeLabels[name] })),
    (value) => {
      if (!isShowMode(value)) return;
      mode = value;
      apply();
    },
  );
  addButton(page.controls, 'reset', 'Reset', () => {
    chosen = undefined;
    host.session.dispatch('sets.select', { members: [] });
    picked = '';
    readout.textContent = 'Click an object to read where it sits.';
    apply();
  });

  // The controls show the choice that is in force, whether a click or `act` made it: the picker of
  // the chosen kind holds its group, the other two go back to their "all" line.
  const showChoice = (): void => {
    for (const [kind, select] of selects) select.value = chosen?.kind === kind ? chosen.id : '';
    modeSelect.value = mode;
  };

  const shownCount = (): number => shownObjects(host.session, model.keys, model.base).length;

  const describeChoice = (): string => {
    const group = chosenGroup();
    return group === undefined ? 'everything shown' : `${modeLabels[mode]}: ${group.kind} ${group.label}`;
  };

  const writeStatus = (): void => {
    page.status.textContent =
      `${shownCount()} of ${model.keys.length} objects drawn · ${describeChoice()}` +
      (problem === '' ? '' : ` · ${problem}`);
  };

  // Sends the camera to the chosen storey through the navigation feature, which is the one place
  // that moves the view, so the demo never sets a camera itself.
  const goToChosenLevel = (): void => {
    if (chosen?.kind !== 'storey') return;
    const level = levels.find((one) => one.id === chosen?.id);
    if (level === undefined) return;
    const sent = host.session.dispatch('navigation.goToLevel', { level });
    if (!sent.ok) problem = messagesOf(sent.diagnostics);
  };

  const apply = (): void => {
    const group = chosenGroup();
    const done =
      group === undefined
        ? clearShow(host.session)
        : applyShow(host.session, { members: group.members, all: model.keys, mode });
    problem = done.ok ? '' : messagesOf(done.diagnostics);
    goToChosenLevel();
    showChoice();
    writeStatus();
  };

  const pressed = { x: 0, y: 0, id: -1 };
  page.canvas.addEventListener('pointerdown', (event) => {
    pressed.x = event.clientX;
    pressed.y = event.clientY;
    pressed.id = event.isPrimary && event.button === 0 ? event.pointerId : -1;
  });
  page.canvas.addEventListener('pointerup', (event) => {
    if (pressed.id !== event.pointerId || Math.hypot(pressed.x - event.clientX, pressed.y - event.clientY) > 4) return;
    const hit = host.pick(event.clientX, event.clientY);
    picked = hit?.key ?? '';
    host.session.dispatch('sets.select', { members: hit === undefined ? [] : [hit.key] });
    const place = hit === undefined ? undefined : places.get(hit.key);
    readout.textContent =
      place === undefined
        ? 'Nothing under the pointer.'
        : `${place.name} · ${place.category} · storey ${place.storey === '' ? 'unassigned' : place.storey}` +
          (place.room === '' ? '' : ` · room ${place.room}`);
    writeStatus();
  });

  // The view starts framed on the whole building, through the navigation feature so the slice and
  // the camera agree; only when that cannot be done does the host frame it directly.
  const aspect = page.canvas.clientHeight > 0 ? page.canvas.clientWidth / page.canvas.clientHeight : 1;
  if (!host.session.dispatch('navigation.frame', { bounds: host.bounds(), aspect }).ok) host.fit();
  writeStatus();

  return success({
    report: () => ({
      objects: model.keys.length,
      storeys: groups.storeys.length,
      rooms: groups.rooms.length,
      categories: groups.categories.length,
      mode,
      chosenGroup: chosen === undefined ? 'none' : `${chosen.kind}:${chosen.id}`,
      chosenObjects: chosenGroup()?.count ?? 0,
      shownObjects: shownCount(),
      picked,
      problem,
    }),
    act: (name, input) => {
      if (name === 'reset') {
        chosen = undefined;
        apply();
        return true;
      }
      if (name !== 'show') return false;
      const asked = showAction(input);
      if (asked === undefined || findGroup(groups, asked.kind, asked.id) === undefined) return false;
      chosen = { kind: asked.kind, id: asked.id };
      mode = asked.mode ?? mode;
      apply();
      return true;
    },
  });
});
