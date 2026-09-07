import { applyEnvironment } from '../../src/environment.js';
import type { FeatureDemo } from '../gallery/contracts.js';
export const environmentDemo: FeatureDemo={
  id:'environment',title:'Background and basic lighting',description:'Adjust a small review light rig and background. Expensive effects remain disabled.',source:'examples/features/environment.ts',tests:'test/environment.test.ts',
  mount(context){
    let restore=()=>{};
    const apply=(background:number,intensity:number,warmth=0)=>{restore();restore=applyEnvironment(context.viewer.objects.scene,{background,intensity,warmth});context.viewer.requestRender();};
    context.button('Neutral studio',()=>apply(0xdce4e9,1));
    context.button('Dark studio',()=>apply(0x15232c,1));
    context.button('Warm daylight',()=>apply(0xede7dc,1.4,0.5));
    context.button('Low light',()=>apply(0x101820,0.3));
    return()=>{restore();context.viewer.requestRender();};
  },
};
