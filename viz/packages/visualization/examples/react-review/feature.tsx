import { createRoot } from 'react-dom/client';
import type { FeatureDemo } from '../gallery/contracts.js';
import { ReviewApp } from './app.js';
import { ReviewController } from './controller.js';

export const reactReviewDemo: FeatureDemo = {
  id: 'react-review', title: 'React door review application',
  description: 'A React-owned source-backed door table, evidence panel, linked selection, coverage colors and saved selections using the same public toolkit APIs.',
  source: 'examples/react-review/feature.tsx', tests: 'test/react-review.test.ts · test/building-model.test.ts · test/storage.test.ts',
  mount(context) {
    const container = document.createElement('div'); context.panel.append(container);
    const controller = new ReviewController(context.selection, context.base, objects => context.update(objects));
    const root = createRoot(container);
    root.render(<ReviewApp context={context} controller={controller} />);
    return () => { root.unmount(); controller.dispose(); container.remove(); };
  },
};
