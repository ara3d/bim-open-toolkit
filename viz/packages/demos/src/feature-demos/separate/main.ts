// Separate the levels and the rooms, lift the lid.
//
// The synthetic building with its roof and ceilings, arranged four ways - as the model places it,
// the storeys spaced vertically through `layouts.explode`, the storeys side by side on the ground,
// and the rooms of one storey side by side - with the roof and ceilings hidden by an appearance
// rule and a horizontal cutaway through the clipping feature.
//
// The layouts feature is installed for its commands and its slice but not for its row-writing hook:
// the page's own writer is the single thing that moves rows, because two writers over one set of
// group buffers would each undo the other. See `writer.ts` and the checkpoint's request to FB.

import { boundsSize, failure, success } from '@bim-open-toolkit/model';
import {
  appearanceFeatureFor,
  clippingFeature,
  clippingHook,
  editsFeature,
  layoutsFeature,
  sceneRenderTarget,
  setsFeature,
} from '@bim-open-toolkit/features';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { addButton, addCheckbox, addSelect, addSlider, setChoices } from '../_shared/controls.js';
import { mountFeatureDemo } from '../_shared/page.js';
import { defaultSpacing, separateDemo } from './controller.js';
import { layoutKinds, type LayoutKind } from './layout.js';
import { layoutWriter } from './writer.js';

// What each arrangement is called in the picker.
const layoutLabels: Readonly<Record<LayoutKind, string>> = {
  'as-placed': 'As placed',
  stacked: 'Storeys spaced apart',
  'storey-row': 'Storeys in a row',
  'room-row': 'Rooms of one storey in a row',
};

// The arrangements that put a storey's rooms in a row, so the storey picker is only offered then.
const usesStorey = (kind: LayoutKind): boolean => kind === 'room-row';

void mountFeatureDemo((host, page) => {
  const building = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
  const opened = host.open('building', building.model, building.geometry);
  if (!opened.ok) return failure(opened.diagnostics);
  const model = opened.value;

  const writer = layoutWriter({
    table: model.table,
    model: model.model,
    dirty: model.dirty,
    moved: () => {
      host.publish();
    },
  });

  const installed = host.features.install([
    editsFeature,
    setsFeature,
    appearanceFeatureFor(sceneRenderTarget(host.binding), model.base),
    layoutsFeature,
    { ...clippingFeature, install: clippingHook(host.clipping) },
  ]);
  if (!installed.ok) return failure(installed.diagnostics);

  const bounds = host.bounds();
  const cutRange = { min: bounds.min[2] ?? 0, max: bounds.max[2] ?? 1 };
  const demo = separateDemo({
    session: host.session,
    model: model.model,
    keys: model.keys,
    base: model.base,
    apply: writer.apply,
    cutRange,
    onChange: () => {
      show();
    },
  });

  const layoutPicker = addSelect(
    page.controls,
    'layout',
    'Layout',
    layoutKinds.map((kind) => ({ value: kind, label: layoutLabels[kind] })),
    (value) => {
      demo.act('layout', value);
      frame();
    },
  );
  const storeyPicker = addSelect(page.controls, 'storey', 'Rooms of', [], (value) => {
    demo.act('storey', value);
    frame();
  });
  setChoices(
    storeyPicker,
    demo.storeys().map((level) => ({ value: level.id, label: level.name })),
  );
  storeyPicker.value = demo.state().storeyId;
  const spacingSlider = addSlider(
    page.controls,
    'spacing',
    'Spacing',
    { min: 0, max: 3, step: 0.05, value: defaultSpacing },
    (value) => {
      demo.act('spacing', value);
    },
  );
  const lidBox = addCheckbox(page.controls, 'lid', 'Roof and ceilings off', false, (checked) => {
    demo.act('lid', checked);
  });
  const cutBox = addCheckbox(page.controls, 'cutaway', 'Cutaway', false, (checked) => {
    demo.act('cutaway', checked);
  });
  const cutSlider = addSlider(
    page.controls,
    'cut-height',
    'Cut at',
    { min: cutRange.min, max: cutRange.max, step: 0.1, value: (cutRange.min + cutRange.max) / 2 },
    (value) => {
      demo.act('cutHeight', value);
    },
  );
  addButton(page.controls, 'reset', 'Reset', () => {
    demo.act('reset');
    frame();
  });

  // The report a browser test reads: what is arranged, how wide and how tall it now is, and how
  // many objects the resolved appearance draws.
  const report = (): Readonly<Record<string, string | number | boolean>> => {
    const state = demo.state();
    const size = boundsSize(host.bounds()) ?? [0, 0, 0];
    return {
      layout: state.layout,
      spacing: state.spacing,
      storey: state.storeyId,
      lidOff: state.lidOff,
      cutaway: state.cutaway,
      cutHeight: state.cutHeight,
      boundsWidth: size[0] ?? 0,
      boundsHeight: size[2] ?? 0,
      shownObjects: demo.shownObjects(),
      objects: model.model.objects.length,
    };
  };

  // Puts the controls and the status line back in step with the state, whatever changed it.
  function show(): void {
    const state = demo.state();
    const current = report();
    layoutPicker.value = state.layout;
    storeyPicker.value = state.storeyId;
    storeyPicker.disabled = !usesStorey(state.layout);
    spacingSlider.value = String(state.spacing);
    lidBox.checked = state.lidOff;
    cutBox.checked = state.cutaway;
    cutSlider.value = String(state.cutHeight);
    page.status.textContent =
      `${layoutLabels[state.layout]} · ${current.shownObjects} of ${current.objects} objects drawn · ` +
      `${Number(current.boundsWidth).toFixed(1)} m wide, ${Number(current.boundsHeight).toFixed(1)} m tall` +
      (state.cutaway ? ` · cut at ${state.cutHeight.toFixed(1)} m` : '');
  }

  // Frames whatever is drawn now, which is what an arrangement change asks for.
  function frame(): void {
    host.fit(undefined, true);
  }

  show();
  return success({
    report,
    act: (name, input) => {
      const done = demo.act(name, input);
      if (done && (name === 'layout' || name === 'storey' || name === 'reset')) frame();
      return done;
    },
    dispose: () => {
      writer.dispose();
    },
  });
});
