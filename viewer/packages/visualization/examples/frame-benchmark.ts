// Diagnostic harness, deliberately separate from the gallery and production API.
import { WebGLRenderer, WebGLRenderTarget, PerspectiveCamera, HemisphereLight, DirectionalLight, Vector3, MeshBasicMaterial, BatchedMesh, Mesh, Plane, Matrix4 } from 'three';
import { ViewerScene, SceneObject, sceneBounds } from '@ara3d/viewer-core';
import { loadBosModel } from '../src/loading.js';
import { RenderBinding } from '../src/render.js';
import { objectKey, type ObjectRecord } from '../src/contracts.js';

type UpdateOperation = 'color' | 'visibility' | 'transform' | 'ghost';
function updatedRecords(records: readonly ObjectRecord[], operation: UpdateOperation): ObjectRecord[] {
  const translation = new Matrix4().makeTranslation(0,1,0).toArray();
  return records.map(o=>({...o,transform:operation==='transform'?translation as unknown as typeof o.transform:o.transform,
    appearance:{...o.appearance,...(operation==='color'?{color:[0.9,0.1,0.1] as const}:operation==='visibility'?{visible:false}:operation==='ghost'?{opacity:0.18}:{})}}));
}

export async function prepare() {
  const info = await (await fetch('/__fixtures/snowdon-info.json')).json();
  const bytes = await (await fetch('/__fixtures/snowdon.bos')).arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== info.sha256 || new Uint8Array(bytes)[0] !== 0x50 || new Uint8Array(bytes)[1] !== 0x4b) throw Error('Fixture integrity failure');
  const loaded = await loadBosModel(bytes, {id:'snowdon', revision:hash}, {sourceUp:'Z'});
  if (!loaded.ok) throw Error(JSON.stringify(loaded.diagnostics));
  const scene = new ViewerScene();
  const binding = new RenderBinding(scene, () => {});
  const added = binding.addModel('snowdon', loaded.value.bindings);
  if (!added.ok) throw Error(JSON.stringify(added.diagnostics));
  const mirror = new SceneObject(scene);
  mirror.sync();
  const canvas = document.createElement('canvas');
  document.body.replaceChildren(canvas);
  const renderer = new WebGLRenderer({canvas, antialias:true});
  renderer.setSize(1000, 700);
  const camera = new PerspectiveCamera(50, 1000/700, 0.1, 100000);
  const bounds = sceneBounds(scene)!;
  const center = new Vector3(...bounds.min).add(new Vector3(...bounds.max)).multiplyScalar(0.5);
  const radius = new Vector3(...bounds.max).distanceTo(new Vector3(...bounds.min)) * 0.9;
  const sun = new DirectionalLight(0xffffff, 2); sun.position.set(1,2,1.5);
  mirror.scene.add(new HemisphereLight(0xffffff, 0x445566, 1), sun);
  const batches: BatchedMesh[] = [];
  mirror.scene.traverse(x => { if (x instanceof BatchedMesh) batches.push(x); });
  const packed = mirror.scene.children.flatMap(root=>root.children).filter((x): x is Mesh=>x instanceof Mesh && !(x instanceof BatchedMesh));
  const selectPath = (legacy:boolean) => {
    for (const batch of batches) batch.visible = legacy || (batch.material as MeshBasicMaterial).transparent || !batch.parent?.children.some(x=>packed.includes(x as Mesh));
    for (const mesh of packed) mesh.visible = !legacy && !(mesh.material as MeshBasicMaterial).transparent;
  };
  let preparationMs = 0;
  for (const batch of batches) {
    const original = batch.onBeforeRender;
    batch.onBeforeRender = function(...args) { const start = performance.now(); original.apply(this,args); preparationMs += performance.now()-start; };
  }
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const basic = new MeshBasicMaterial();
  const metadata = {hash, bytes:bytes.byteLength, groups:scene.groupCount, instances:loaded.value.bindings.length,
    triangles:scene.groups.reduce((n,g)=>n+(g.mesh.indices?.length??g.mesh.positions.length/3)/3*g.instanceCount,0), batches:batches.length,
    transparentBatches:batches.filter(b=>(b.material as MeshBasicMaterial).transparent).length,
    packedMeshes:packed.length, packedBufferBytes:packed.reduce((n,m)=>n+Object.values(m.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(m.geometry.index?.array.byteLength??0),0),
    gpu:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', multiDraw:!!gl.getExtension('WEBGL_multi_draw'),
    viewport:[1000,700], dpr:1, camera:{center:center.toArray(),radius}, gpuTiming:'not measured', userAgent:navigator.userAgent};
  const percentile = (values:number[], q:number) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1];
  const represented = new Set(loaded.value.bindings.map(b=>objectKey(b.ref)));
  const records = loaded.value.model.objects.filter(o=>represented.has(objectKey(o.ref))).slice(0,10000);
  if(records.length!==10000)throw Error('Need 10,000 distinct represented objects');
  return { metadata,
    async measure(variant:string) {
      selectPath(variant==='legacy');
      renderer.setSize(variant==='half-resolution'?500:1000,variant==='half-resolution'?350:700);
      mirror.scene.overrideMaterial = variant==='unlit'?basic:null;
      for (const batch of batches) {
        batch.sortObjects = variant==='default' ? batch.sortObjects : !['opaque-unsorted','unculled-unsorted'].includes(variant) || (batch.material as MeshBasicMaterial).transparent;
        batch.perObjectFrustumCulled = !['unculled','unculled-unsorted'].includes(variant);
      }
      const samples: {interval:number;sync:number;prepare:number;cpu:number;calls:number;triangles:number}[] = [];
      let previous = await new Promise<number>(requestAnimationFrame);
      for (let i=0;i<45;i++) {
        const timestamp = await new Promise<number>(requestAnimationFrame);
        const interval = timestamp-previous; previous=timestamp;
        // Identical slow orbit for every variant, including warm-up.
        const angle = i/44*Math.PI/4;
        camera.position.set(center.x+Math.cos(angle)*radius,center.y+radius*0.55,center.z+Math.sin(angle)*radius);
        camera.lookAt(center); camera.updateMatrixWorld();
        const start = performance.now();
        if (variant!=='no-sync') mirror.sync();
        const sync = performance.now()-start;
        preparationMs=0;
        renderer.render(mirror.scene,camera);
        if (i>=5) samples.push({interval,sync,prepare:preparationMs,cpu:performance.now()-start,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
      }
      gl.finish();
      const metrics = Object.fromEntries(['interval','sync','prepare','cpu','calls','triangles'].map(key=>{
        const values=samples.map(s=>s[key as keyof typeof s]);
        return [key,{p50:percentile(values,0.5),p95:percentile(values,0.95)}];
      }));
      return {variant,metrics,samples};
    },
    async verify() {
      const target = new WebGLRenderTarget(1000,700);
      const reference = new Uint8Array(1000*700*4), actual = new Uint8Array(reference.length);
      const results=[];
      const compare = (name:string) => {
        mirror.sync(); renderer.setRenderTarget(target);
        selectPath(true); renderer.render(mirror.scene,camera); renderer.readRenderTargetPixels(target,0,0,1000,700,reference);
        selectPath(false); renderer.render(mirror.scene,camera); renderer.readRenderTargetPixels(target,0,0,1000,700,actual);
        let different=0, nonempty=0;
        for(let i=0;i<actual.length;i+=4){
          if(actual[i] || actual[i+1] || actual[i+2])nonempty++;
          if([0,1,2,3].some(c=>Math.abs(actual[i+c]-reference[i+c])>8))different++;
        }
        const passed=!!nonempty && different/700000<=0.01;
        const png=(pixels:Uint8Array)=>{const c=document.createElement('canvas');c.width=1000;c.height=700;const ctx=c.getContext('2d')!;const data=ctx.createImageData(1000,700);data.data.set(pixels);ctx.putImageData(data,0,0);return c.toDataURL();};
        return {name,passed,differentPixels:different,totalPixels:700000,nonempty,...(!passed?{images:{reference:png(reference),actual:png(actual)}}:{})};
      };
      try {
        results.push(compare('original'));
        for(const operation of ['color','visibility','transform','ghost'] as const){
          const changed=updatedRecords(records,operation);
          const start=performance.now(); const result=binding.update(changed); if(!result.ok)throw Error(JSON.stringify(result)); mirror.sync();
          const submissionMs=performance.now()-start;
          results.push({...compare(operation),objects:records.length,submissionMs});
          binding.update(records); mirror.sync();
        }
        renderer.localClippingEnabled=true;
        for(const batch of batches)(batch.material as MeshBasicMaterial).clippingPlanes=[new Plane(new Vector3(1,0,0),-center.x)];
        results.push(compare('clipping'));
      } finally {
        for(const batch of batches)(batch.material as MeshBasicMaterial).clippingPlanes=null;
        renderer.localClippingEnabled=false; renderer.setRenderTarget(null); target.dispose();
      }
      return results;
    },
    async measureUpdates(operation:UpdateOperation) {
      const changed=updatedRecords(records,operation);
      const samples: {modelMs:number;submissionMs:number;nextRafMs:number}[]=[];
      for(let i=0;i<25;i++){
        await new Promise(requestAnimationFrame);
        const start=performance.now();
        const result=binding.update(changed); if(!result.ok)throw Error(JSON.stringify(result));
        mirror.sync(); const modelMs=performance.now()-start;
        renderer.render(mirror.scene,camera); const submissionMs=performance.now()-start;
        await new Promise(requestAnimationFrame); const nextRafMs=performance.now()-start;
        if(i>=5)samples.push({modelMs,submissionMs,nextRafMs});
        const reset=binding.update(records); if(!reset.ok)throw Error(JSON.stringify(reset));
        mirror.sync(); renderer.render(mirror.scene,camera);
      }
      return {operation,objects:records.length,warmups:5,sampleCount:20,
        metrics:Object.fromEntries((['modelMs','submissionMs','nextRafMs'] as const).map(key=>[key,{p50:percentile(samples.map(s=>s[key]),0.5),p95:percentile(samples.map(s=>s[key]),0.95)}])),samples};
    },
    dispose() {basic.dispose();mirror.dispose();binding.dispose();renderer.dispose();}
  };
}
