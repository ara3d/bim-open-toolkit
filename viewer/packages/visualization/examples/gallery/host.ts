import { Viewer, sceneBounds } from '@ara3d/viewer-core';
import { OrbitControls, ndcFromClient } from '@ara3d/viewer-controls';
import { RenderBinding } from '../../src/render.js';
import { SelectionStore } from '../../src/selection.js';
import { objectKey } from '../../src/contracts.js';
import { loadBosModel } from '../../src/loading.js';
import type { FeatureDemo, DemoContext } from './contracts.js';
import { smallFixture } from './fixture.js';
import { observeResize } from '../observe-resize.js';

/** One route, one renderer; feature controls are mounted only after its model is ready. */
export async function mountViewer(feature: FeatureDemo, root: HTMLElement): Promise<() => void> {
  root.innerHTML = `<div class="feature-top"><a href="./">← Feature gallery</a><span id="model-count">Opening model</span></div><div class="lab"><section class="viewport"><canvas aria-label="3D feature viewer"></canvas><p class="viewport-note" role="status">Loading Snowdon…</p></section><aside><h1></h1><p class="description"></p><label>Model<select id="model-choice"><option value="snowdon">Snowdon · primary fixture</option><option value="bfast">Snowdon · prepared BFAST</option><option value="small">Small deterministic fixture</option></select></label><div class="baseline"><button id="fit">Fit model</button><button id="reset">Reset feature</button><button id="cancel">Cancel load</button></div><div id="feature-controls"></div><details><summary>Source and verification</summary><a id="source-link">Feature source</a><p id="test-command"></p></details></aside></div>`;
  const canvas = root.querySelector('canvas')!;
  const panel = root.querySelector<HTMLElement>('#feature-controls')!;
  root.querySelector('h1')!.textContent = feature.title;
  root.querySelector('.description')!.textContent = feature.description;
  root.querySelector('#test-command')!.textContent = feature.tests;
  root.querySelector<HTMLAnchorElement>('#source-link')!.href = `/${feature.source.replace(/^examples\//,'')}`;
  const status = (message: string) => { const note=root.querySelector('.viewport-note')!; note.textContent=message;note.setAttribute('role','status');note.classList.remove('error'); };
  const showError = (message: string) => {
    const note=root.querySelector('.viewport-note')!;
    status(message);note.setAttribute('role','alert');note.classList.add('error');
    console.error(message);
  };
  const fail = (message: string) => {
    root.querySelector('#model-count')!.textContent = 'MODEL LOAD FAILED';
    showError(`Model load failed: ${message}`);
    const retry = document.createElement('button'); retry.textContent='Retry loading'; retry.onclick=()=>location.reload(); panel.append(retry);
  };
  const controller = new AbortController();
  let openingStage='Viewer initialization';
  const viewer = new Viewer({ background:0xdce4e9 });
  const selection = new SelectionStore();
  const render = new RenderBinding(viewer.scene, () => viewer.requestRender());
  const controls = new OrbitControls(viewer);
  let cleanupFeature = () => {};
  let disposed = false;
  let stopResize = () => {};
  const dispose = () => {
    if(disposed)return;disposed=true;window.removeEventListener('pagehide',dispose);controller.abort();
    root.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true;});
    const failures:unknown[]=[];
    for(const release of [cleanupFeature,()=>stopResize(),()=>controls.dispose(),()=>selection.dispose(),()=>render.dispose(),()=>viewer.dispose()]){
      try{release();}catch(error){failures.push(error);}
    }
    if(failures.length)showError(`Cleanup failed: ${failures.map(String).join('; ')}`);
  };
  window.addEventListener('pagehide',dispose,{once:true});
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();dispose();
    root.querySelector('#model-count')!.textContent='GRAPHICS CONTEXT LOST';
    showError('Graphics context lost. Reload this demo to recreate its renderer.');
    const retry=document.createElement('button');retry.textContent='Reload viewer';retry.onclick=()=>location.reload();panel.append(retry);
  },{signal:controller.signal});
  root.querySelector<HTMLButtonElement>('#cancel')!.onclick = () => { controller.abort(); status('Load cancelled. Choose a model to retry.'); };
  const choice = root.querySelector<HTMLSelectElement>('#model-choice')!;
  const requestedModel = new URLSearchParams(location.search).get('model');
  choice.value = requestedModel === 'small' || requestedModel === 'bfast' ? requestedModel : 'snowdon';
  choice.onchange = () => { dispose(); const url = new URL(location.href); url.searchParams.set('model',choice.value); location.href = url.href; };
  try {
    viewer.attach(canvas);
    stopResize = observeResize(canvas, () => viewer.resize(canvas.clientWidth,canvas.clientHeight,Math.min(devicePixelRatio,2)));
    controls.attach({
      addEventListener:(type,listener)=>canvas.addEventListener(type,listener as EventListener),
      removeEventListener:(type,listener)=>canvas.removeEventListener(type,listener as EventListener),
      get clientHeight(){return canvas.clientHeight;},
      setPointerCapture:id=>canvas.setPointerCapture(id), releasePointerCapture:id=>canvas.releasePointerCapture(id),
    });
    openingStage='Model loading';
    const started = performance.now();
    let revision='small-fixture';
    if(choice.value!=='small'){
      const response=await fetch(choice.value === 'bfast' ? '/__fixtures/snowdon-bfast-info.json' : '/__fixtures/snowdon-info.json',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw new Error(`Snowdon metadata endpoint failed (${response.status}).`);
      const info:unknown=await response.json();
      if(!info||typeof info!=='object'||!('sha256'in info)||typeof info.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(info.sha256))throw new Error('Invalid Snowdon fingerprint metadata.');
      revision=`sha256:${info.sha256}`;
    }
    let lastProgress = 0;
    const result = choice.value === 'small' ? {ok:true as const,value:smallFixture(),diagnostics:[]} : await loadBosModel(choice.value === 'bfast' ? '/__fixtures/snowdon.bfast' : '/__fixtures/snowdon.bos',{id:'snowdon',revision},{sourceUp:'Z',signal:controller.signal,onProgress:p=>{
      if(performance.now()-lastProgress>100 || p.loaded===p.total){lastProgress=performance.now();status(`Snowdon · ${p.stage} ${p.loaded}${p.total ? ` / ${p.total}` : ''}`);}
    }});
    if (disposed || controller.signal.aborted) return dispose;
    if (!result.ok) { fail(result.diagnostics.map(d=>d.message).join('; ')); return dispose; }
    const {model,bindings} = result.value;
    openingStage='Model rendering';
    const baseKeys = new Set(model.objects.map(object=>objectKey(object.ref)));
    const representedKeys = new Set(bindings.map(binding=>objectKey(binding.ref)));
    const bound = render.addModel(model.ref.id,bindings);
    if (!bound.ok) { fail(bound.diagnostics.map(d=>d.message).join('; ')); return dispose; }
    const fit = () => {
      viewer.resize(canvas.clientWidth,canvas.clientHeight,Math.min(devicePixelRatio,2));
      const bounds = sceneBounds(viewer.scene);
      const vertical = viewer.camera.fov*Math.PI/180;
      const horizontal = 2*Math.atan(Math.tan(vertical/2)*viewer.camera.aspect);
      if (bounds) controls.model.frame(bounds,Math.min(vertical,horizontal));
      controls.update();
    };
    const context: DemoContext = {
      viewer,controls,render,canvas,model,base:model.objects,selection,panel,status,fit,
      button(label,action) { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { Promise.resolve().then(action).catch(error=>showError(`${label} failed: ${String(error)}`)); }; panel.append(button); return button; },
      update(objects) {
        const update = render.applySnapshot(objects);
        const unexpected=update.diagnostics.filter(d=>d.code!=='unbound-object'||!d.ref||!baseKeys.has(objectKey(d.ref)));
        if(!update.ok||unexpected.length)showError(`Update failed: ${(unexpected.length?unexpected:update.diagnostics).map(d=>d.message).join('; ')}`);
      },
      reset() { cleanupFeature(); selection.replace([]); panel.replaceChildren(); render.applySnapshot(model.objects); cleanupFeature=feature.mount(context); viewer.requestRender(); },
    };
    cleanupFeature = feature.mount(context);
    root.querySelector<HTMLButtonElement>('#fit')!.onclick = fit;
    root.querySelector<HTMLButtonElement>('#reset')!.onclick = context.reset;
    root.querySelector<HTMLButtonElement>('#cancel')!.hidden = true;
    const triangles = viewer.scene.groups.reduce((n,g)=>n+(g.mesh.indices?.length??g.mesh.positions.length/3)/3*g.instanceCount,0);
    root.querySelector('#model-count')!.textContent = `${choice.value==='small'?'Small fixture':'Snowdon'} · ${model.objects.length.toLocaleString()} objects (${(model.objects.length-representedKeys.size).toLocaleString()} without rendered geometry) · ${bindings.length.toLocaleString()} instances · ${triangles.toLocaleString()} triangles`;
    let down: {x:number;y:number;id:number}|undefined;
    canvas.addEventListener('pointerdown',event=>{down=event.isPrimary&&event.button===0?{x:event.clientX,y:event.clientY,id:event.pointerId}:undefined;},{signal:controller.signal});
    canvas.addEventListener('pointermove',event=>{if(down&&(down.id!==event.pointerId||Math.hypot(down.x-event.clientX,down.y-event.clientY)>4))down=undefined;},{signal:controller.signal});
    canvas.addEventListener('pointercancel',()=>{down=undefined;},{signal:controller.signal});
    canvas.addEventListener('pointerup',event=>{
      if(!down||down.id!==event.pointerId||Math.hypot(down.x-event.clientX,down.y-event.clientY)>4){down=undefined;return;}
      down=undefined;const ndc=ndcFromClient(canvas.getBoundingClientRect(),event.clientX,event.clientY);
      const hit=render.pick(viewer.objects,viewer.renderCamera,ndc.x,ndc.y);
      if(hit){event.ctrlKey||event.metaKey?selection.toggle([hit.ref]):selection.replace([hit.ref]);status(model.objects.find(object=>object.ref.modelId===hit.ref.modelId&&object.ref.objectId===hit.ref.objectId)?.name??hit.ref.objectId);}
    },{signal:controller.signal});
    fit(); viewer.renderFrame();
    status(`Ready · ${(performance.now()-started).toFixed(0)} ms to first submitted frame. Drag to orbit, shift-drag to pan, scroll to zoom.`);
  } catch(error) {
    if(!disposed&&!controller.signal.aborted){
      if(openingStage==='Model loading')fail(String(error));
      else {dispose();root.querySelector('#model-count')!.textContent=`${openingStage.toUpperCase()} FAILED`;showError(`${openingStage} failed: ${String(error)}`);const retry=document.createElement('button');retry.textContent='Reload viewer';retry.onclick=()=>location.reload();panel.append(retry);}
    }
  }
  return dispose;
}
