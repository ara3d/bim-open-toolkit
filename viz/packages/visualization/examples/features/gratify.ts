import { mountReviewControls } from '../../src/gratify.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const gratifyDemo: FeatureDemo = {
  id: 'gratify', title: 'Gratify review controls',
  description: 'A small Gratify canvas UI drives fit, selection and ghosting through typed host commands. Equivalent HTML buttons remain available.',
  source: 'examples/features/gratify.ts', tests: 'test/gratify.test.ts',
  mount(context) {
    const canvas = document.createElement('canvas'); canvas.style.width = '100%'; canvas.style.height = '196px'; canvas.setAttribute('aria-label', 'Gratify review controls; equivalent buttons follow');
    const note = document.createElement('p'); note.textContent = 'Canvas: Up/Down selects a control, Enter activates; Tab leaves the canvas. Equivalent HTML buttons support screen readers and native keyboard navigation.';
    context.panel.append(canvas, note);
    let ghost = false;
    let ghostButton: HTMLButtonElement | undefined;
    const ui = mountReviewControls(canvas, {
      fit: () => context.fit(),
      clearSelection: () => { context.selection.replace([]); context.status('Selection cleared.'); },
      toggleGhost: () => {
        ghost = !ghost;
        ghostButton?.setAttribute('aria-pressed', String(ghost));
        context.update(context.base.map(object => ({ ...object, appearance: { ...object.appearance, opacity: ghost ? 0.2 : object.appearance.opacity } })));
        context.status(ghost ? 'Model ghosted to 20% opacity.' : 'Source opacity restored.');
      },
    });
    context.button('Fit model (HTML)', () => ui.dispatch('fit'));
    context.button('Clear selection (HTML)', () => ui.dispatch('clearSelection'));
    ghostButton = context.button('Toggle ghosting (HTML)', () => { ui.dispatch('toggleGhost'); });
    ghostButton.setAttribute('aria-pressed', 'false');
    return () => { ui.dispose(); canvas.remove(); note.remove(); };
  },
};
