import { sceneBounds } from '@ara3d/viewer-core';
import { addNavigationAids } from '../../src/navigation-aids.js';
import type { FeatureDemo } from '../gallery/contracts.js';
export const navigationDemo: FeatureDemo={
  id:'navigation',title:'Axes, bounds and reference grid',description:'Inspect model extent and coordinate orientation with optional spatial guides.',source:'examples/features/navigation.ts',tests:'test/environment.test.ts',
  mount(context){
    const bounds=sceneBounds(context.viewer.scene);if(!bounds)return()=>{};
    const aids=addNavigationAids(context.viewer.objects.scene,bounds);
    const button=context.button('Hide spatial guides',()=>{aids.root.visible=!aids.root.visible;button.textContent=aids.root.visible?'Hide spatial guides':'Show spatial guides';context.viewer.requestRender();});
    const information=document.createElement('p');information.textContent=`World extent: ${bounds.max.map((n,i)=>(n-bounds.min[i]!).toFixed(2)).join(' × ')}. Source units are unknown; no dimension conversion is implied.`;context.panel.append(information);
    context.viewer.requestRender();return()=>{aids.dispose();context.viewer.requestRender();};
  },
};
