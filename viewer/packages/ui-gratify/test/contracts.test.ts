import { describe, expect, it } from 'vitest';
import { diagnostic, failure } from '@bim-open-toolkit/model';
import { Label } from 'gratify';
import {
  conflictingValue,
  hudPanel,
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  sheetCoverage,
  type AnyHudPanel,
  type HudPanel,
  type PanelMount,
} from '../src/index.js';

type Doc = { readonly count: number };
type Intent = { readonly kind: 'add' };

const counter: HudPanel<Doc, Intent> = {
  id: 'counter',
  place: { kind: 'corner', corner: 'top-left' },
  spec: {
    init: { count: 0 },
    update: (doc, intent) => (intent.kind === 'add' ? { count: doc.count + 1 } : doc),
    view: (doc) => Label('count', { text: String(doc.count) }),
  },
};

describe('G1 contracts', () => {
  it('closes a typed panel over its types so panels of different types share one list', () => {
    const panels: readonly AnyHudPanel[] = [hudPanel(counter)];
    const seen: string[] = [];
    // A mount that records what it was handed and hosts nothing, because there is no canvas here.
    const mount: PanelMount = (panel) => {
      seen.push(`${panel.id}:${panel.spec.update(panel.spec.init, panel.spec.init as never) === panel.spec.init}`);
      return failure([diagnostic('test/no-canvas', 'not hosted in a unit test')]);
    };
    for (const panel of panels) panel.host(mount);
    expect(seen).toEqual(['counter:true']);
  });

  it('counts the states of a sheet', () => {
    const sheet = propertySheet('Door 1-2-1', [
      propertyGroup('facts', 'Facts', [
        propertyRow('width', 'Nominal width', knownNumber(0.9, 'm')),
        propertyRow('rating', 'Fire rating', missingValue('not-provided')),
        propertyRow('clear', 'Clear width', conflictingValue(['0.8', '0.85'], ['survey', 'model'])),
        propertyRow('name', 'Name', knownValue('Door 1-2-1')),
      ]),
    ]);
    expect(sheetCoverage(sheet)).toEqual({ known: 2, missing: 1, conflicting: 1 });
    expect(sheet.groups[0]?.rows[2]?.value.text).toBe('0.8 vs 0.85');
  });
});
