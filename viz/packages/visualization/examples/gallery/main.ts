import './style.css';
import { mountViewer } from './host.js';
import { selectionDemo } from '../features/selection.js';
import { appearanceDemo } from '../features/appearance.js';
import { editsDemo } from '../features/edits.js';
import { persistenceDemo } from '../features/persistence.js';
import { cameraDemo } from '../features/camera.js';
import { clippingDemo } from '../features/clipping.js';
import { layoutsDemo } from '../features/layouts.js';
import { annotationsDemo } from '../features/annotations.js';
import { captureDemo } from '../features/capture.js';
import { comparisonDemo } from '../features/comparison.js';
import { performanceDemo } from '../features/performance.js';
import { animationDemo } from '../features/animation.js';
import { formatsDemo } from '../features/formats.js';
import { environmentDemo } from '../features/environment.js';
import { navigationDemo } from '../features/navigation.js';
import { replacementDemo } from '../features/replacement.js';
import { doorsDemo } from '../features/doors.js';
import { gratifyDemo } from '../features/gratify.js';
import { projectionDemo } from '../features/projection.js';
import { storageDemo } from '../features/storage.js';
import { assistantDemo } from '../features/assistant.js';
import { reactReviewDemo } from '../react-review/feature.js';
import { loadingChecksDemo } from '../features/loading-checks.js';
const features = [selectionDemo,appearanceDemo,editsDemo,persistenceDemo,cameraDemo,projectionDemo,clippingDemo,layoutsDemo,annotationsDemo,captureDemo,comparisonDemo,performanceDemo,animationDemo,formatsDemo,environmentDemo,navigationDemo,replacementDemo,doorsDemo,gratifyDemo,storageDemo,assistantDemo,reactReviewDemo,loadingChecksDemo];
const root = document.getElementById('app')!;
const fatal = (message: string) => { let alert=document.querySelector<HTMLElement>('.fatal-error'); if(!alert){alert=document.createElement('div');alert.className='fatal-error';alert.setAttribute('role','alert');document.body.append(alert);}alert.textContent=`Viewer error: ${message}`; };
window.addEventListener('error',event=>fatal(event.message));
window.addEventListener('unhandledrejection',event=>fatal(String(event.reason)));
// pagehide releases GPU resources; a back/forward-cache restore needs fresh resources.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
const requested = new URLSearchParams(location.search).get('feature');
const feature = features.find(item=>item.id===requested);
if(feature) { void mountViewer(feature,root); }
else {
  root.innerHTML=`<header><span>BIM / OPEN TOOLKIT</span><span class="badge">Feature laboratory</span></header><main class="gallery"><p class="eyebrow">ONE FEATURE. ONE VIEWER.</p><h1>Explore the building blocks.</h1><p class="intro">Small, independent demos of the public visualization API. Snowdon is the primary test model. Each demo includes its source, reset controls and verification command.</p><div class="cards"></div><p class="footnote">Snowdon stays on this computer. The development server serves the original file locally; production builds do not contain model data. A deterministic fixture is also available in each viewer.</p></main>`;
  const cards=root.querySelector('.cards')!;
  for(const item of features){const link=document.createElement('a');link.className='card';link.href=`?feature=${encodeURIComponent(item.id)}`;const title=document.createElement('h2');title.textContent=item.title;const text=document.createElement('p');text.textContent=item.description;const open=document.createElement('span');open.textContent='Open Snowdon demo →';link.append(title,text,open);cards.append(link);}
}
