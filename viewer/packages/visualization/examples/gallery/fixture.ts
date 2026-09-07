import { BoxGeometry } from 'three';
import { InstancedGroup } from '@ara3d/viewer-core';
import { type ModelData, type ObjectRecord, type Matrix4 } from '../../src/contracts.js';
import type { InstanceBinding } from '../../src/render.js';

export function smallFixture(): { model: ModelData; bindings: readonly InstanceBinding[] } {
  const geometry = new BoxGeometry(0.8, 1.2, 0.8);
  const mesh = { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: new Uint32Array(geometry.index!.array) };
  geometry.dispose();
  const group = new InstancedGroup(mesh);
  const objects: ObjectRecord[] = Array.from({ length: 24 }, (_, index) => {
    const transform: Matrix4 = [1,0,0,0,0,1,0,0,0,0,1,0,index%6,0,Math.floor(index/6),1];
    group.append(new Float32Array(transform),new Float32Array([0.65,0.7,0.75,1]));
    return { ref:{modelId:'fixture',objectId:String(index)},name:`Fixture object ${index}`,transform,appearance:{color:[0.65,0.7,0.75],opacity:1,visible:true} };
  });
  return { model:{ref:{id:'fixture',revision:'1'},coordinates:{units:'metres',up:'Y',registration:'local'},objects},bindings:objects.map((object,instanceIndex)=>({ref:object.ref,group,instanceIndex,representationId:'box'})) };
}
