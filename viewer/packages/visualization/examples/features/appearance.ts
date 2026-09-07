import { composeAppearance, createCategoricalColorMap, createNumericColorMap, type StyleRule } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const appearanceDemo: FeatureDemo = {
  id: 'appearance', title: 'Color mapping and ghosting',
  description: 'Apply synthetic object-index categories or a numeric ramp to Snowdon. These values are demonstration data, not BIM properties.',
  source: 'examples/features/appearance.ts', tests: 'test/appearance.test.ts · test/render.test.ts',
  mount(context) {
    let mode: 'original' | 'category' | 'numeric' = 'original';
    let ghost = false;
    const categories = createCategoricalColorMap([
      { value: 0, label: 'Index % 3 = 0', color: [0.1, 0.45, 0.9] },
      { value: 1, label: 'Index % 3 = 1', color: [0.95, 0.35, 0.1] },
      { value: 2, label: 'Index % 3 = 2', color: [0.25, 0.8, 0.35] },
    ], [0.5, 0.5, 0.5]);
    const numeric = createNumericColorMap({ min: 0, max: Math.max(0, context.base.length - 1), low: [0.1, 0.3, 0.95], high: [0.95, 0.2, 0.1], missingColor: [0.5, 0.5, 0.5] });
    const legend = document.createElement('p'); context.panel.append(legend);
    const refresh = () => {
      const rules: StyleRule[] = mode === 'original' ? [] : context.base.map((object, index) => ({ id: `synthetic-${index}`, members: [object.ref], style: { color: mode === 'category' ? categories.color(index % 3) : numeric.color(index) } }));
      if (ghost) rules.push({ id: 'ghost', members: context.base.map(object => object.ref), style: { opacity: 0.18 } });
      context.update(composeAppearance(context.base, { rules }));
      legend.textContent = mode === 'category' ? 'Synthetic index % 3: 0 blue · 1 orange · 2 green' : mode === 'numeric' ? `Synthetic object index: 0 blue → ${Math.max(0, context.base.length - 1).toLocaleString()} red` : 'Original source colors';
      context.status(`${legend.textContent}${ghost ? ' · opacity 18%' : ''}. Values carry no BIM meaning.`);
    };
    context.button('Synthetic categories', () => { mode = 'category'; refresh(); });
    context.button('Synthetic numeric ramp', () => { mode = 'numeric'; refresh(); });
    const ghostButton = context.button('Ghost objects', () => { ghost = !ghost; ghostButton.textContent = ghost ? 'Make opaque' : 'Ghost objects'; refresh(); });
    context.button('Reset appearance demo', () => { context.reset(); });
    refresh();
    return () => { legend.remove(); };
  },
};
