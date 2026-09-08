// The preset row: four buttons in the viewport's top-left corner, one press each.
//
// The chip is a local part because the ui-gratify widget kit has not been published yet; when
// `Segmented` lands it replaces `PresetChip` and nothing else in this file changes. The panel keeps
// no state of its own beyond the chosen preset: `sync` reads the choice back out of the environment
// slice each change, so a preset set by any other route shows here too.

import { environmentSlice } from '@bim-open-toolkit/features';
import { hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-toolkit/ui-gratify';
import { Press, Row, part, surface, v, type AppSpec, type Element } from 'gratify';
import { presetNames, presetOf, presetTitles, presets, type PresetChoice, type PresetName } from './presets.js';

// What the row shows: the preset in force, or `custom` when the settings match none.
export type PresetDoc = { readonly choice: PresetChoice };

// The only thing the row can say.
export type PresetIntent = { readonly kind: 'choose'; readonly preset: PresetName };

type ChipProps = { readonly name: PresetName; readonly label: string; readonly selected: boolean };

const PresetChip = part<ChipProps>()('environment-preset-chip', {
  size: (props, measure) => v(measure.text(props.label, 12).x + 22, 26),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, props.selected ? { tint: tokens.accent } : {}),
    corner: 6,
  }),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): PresetIntent => ({ kind: 'choose', preset: node.props.name }))],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

// The row of chips for a choice.
export const presetRow = (choice: PresetChoice): Element =>
  Row(
    'environment-presets',
    { gap: 6, pad: 8 },
    presetNames.map((name) =>
      PresetChip(name, { name, label: presetTitles[name], selected: name === choice }),
    ),
  );

// The Gratify app behind the row.
export const presetApp: AppSpec<PresetDoc, PresetIntent> = {
  init: { choice: 'custom' },
  update: (doc, intent) => (intent.kind === 'choose' ? { choice: intent.preset } : doc),
  view: (doc) => presetRow(doc.choice),
};

// The preset row with its types open, so a test can drive `sync` and `onCommit` directly.
export const presetPanelSpec: HudPanel<PresetDoc, PresetIntent> = {
  id: 'environment-presets',
  place: { kind: 'corner', corner: 'top-left' },
  spec: presetApp,
  sync: (session, doc) => {
    const choice = presetOf(session.read(environmentSlice).settings);
    return choice === doc.choice ? doc : { choice };
  },
  onCommit: (doc, previous, session) => {
    if (doc.choice === previous.choice || doc.choice === 'custom') return;
    session.dispatch('environment.set', presets[doc.choice]);
  },
};

// The preset row as the gallery hosts it, in the viewport's top-left corner.
export const presetPanel: AnyHudPanel = hudPanel(presetPanelSpec);

// Every panel this demo draws.
export const environmentPanels: readonly AnyHudPanel[] = [presetPanel];
