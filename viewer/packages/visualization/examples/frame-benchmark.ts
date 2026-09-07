// Diagnostic harness, deliberately separate from the gallery and production API.
import { WebGLRenderer, PerspectiveCamera, HemisphereLight, DirectionalLight, Vector3, MeshBasicMaterial, BatchedMesh } from 'three';
import { ViewerScene, SceneObject, sceneBounds } from '@ara3d/viewer-core';
import { loadBosModel } from '../src/loading.js';
import { RenderBinding } from '../src/render.js';

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
  const batches = mirror.scene.children.filter((x): x is BatchedMesh => x instanceof BatchedMesh);
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
    transparentBatches:batches.filter(b=>(b.material as any).transparent).length,
    gpu:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', multiDraw:!!gl.getExtension('WEBGL_multi_draw'),
    viewport:[1000,700], dpr:1, camera:{center:center.toArray(),radius}, gpuTiming:'not measured', userAgent:navigator.userAgent};
  const percentile = (values:number[], q:number) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1];
  return { metadata,
    async measure(variant:string) {
      renderer.setSize(variant==='half-resolution'?500:1000,variant==='half-resolution'?350:700);
      mirror.scene.overrideMaterial = variant==='unlit'?basic:null;
      for (const batch of batches) {
        batch.sortObjects = variant==='default' ? batch.sortObjects : !['opaque-unsorted','unculled-unsorted'].includes(variant) || (batch.material as any).transparent;
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
    dispose() {basic.dispose();mirror.dispose();binding.dispose();renderer.dispose();}
  };
}
