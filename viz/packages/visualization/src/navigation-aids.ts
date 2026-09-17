import { AxesHelper, Box3, Box3Helper, GridHelper, Group, Vector3, type Scene, type Material } from 'three';
import type { Bounds3 } from '@ara3d/viewer-core';

/** Helpers have no object identity and never participate in the toolkit's model picking. */
export function addNavigationAids(scene: Scene,bounds: Bounds3): { readonly root: Group; dispose(): void } {
  const span=Math.max(...bounds.max.map((n,i)=>n-bounds.min[i]!),1);
  const root=new Group();
  const axes=new AxesHelper(span*0.25);axes.position.set(...bounds.min);
  const grid=new GridHelper(span,10,0x6c7b86,0xa5b2bc);grid.position.set((bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2);
  const box=new Box3Helper(new Box3(new Vector3(...bounds.min),new Vector3(...bounds.max)),0x9a6530);
  root.add(axes,grid,box);scene.add(root);
  let disposed=false;
  return {root,dispose(){if(disposed)return;disposed=true;scene.remove(root);for(const object of [axes,grid,box]){object.geometry.dispose();for(const material of (Array.isArray(object.material)?object.material:[object.material]) as Material[])material.dispose();}}};
}
