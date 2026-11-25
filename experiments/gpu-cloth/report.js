import {xrReceipts} from './xrReceipts.js';
import {stageBuild} from '../../src/shared/stageBuild.ts';

// Bounded one-second windows. A changed mode, pose, renderer or tracking gap
// starts a new warm-up; never mix screen and XR callback intervals.
export function recorder(){
  const xr=xrReceipts(); // Attempts survive actor changes; performance windows belong to the current actor.
  let rows=[],ms=[],world=[],gpu=[],count=0,key='',seq=0,warm=0,dtSum=0,epoch=0,gaps=[];
  const pct=(a,p)=>a.length?+a.toSorted((x,y)=>x-y)[Math.ceil(a.length*p)-1].toFixed(3):null;
  function boundary(){key='';ms=[];world=[];gpu=[];dtSum=0;count=0;warm=0;epoch++;}
  return {xr,boundary,clear(){rows=[];gaps=[];seq=0;boundary();},get rows(){return rows;},get gaps(){return gaps;},get epoch(){return epoch;},sampleGPU(e,t){if(e===epoch&&warm>=1000)gpu.push(t);},
    get exportable(){return !!(rows.length||xr.attempts.length);},
    export(info,timestampQuery){const rig=info&&Object.fromEntries(['particles','pins','sourceBodies','triangles','textures','handSamples','faceSamples','faceSetupWallMs'].map(k=>[k,Number.isFinite(info[k])?info[k]:null]));
      return {schema:2,experiment:'gpu-cloth',entryAsset:stageBuild('cloth'),rig,timestampQuery,windows:rows,gaps,xrAttempts:xr.attempts};},
    gap(kind,mode,dt){gaps.push({kind,mode,afterWindow:seq,gapMs:Math.round(dt)});if(gaps.length>128)gaps.shift();},
    add(meta,dt,steps,worldMs){const k=JSON.stringify(meta);if(k!==key){boundary();key=k;}
      if((warm+=dt)<1000)return;ms.push(dt);dtSum+=dt;count+=steps;if(Number.isFinite(worldMs))world.push(worldMs);
      if(dtSum<1000)return;const r={...meta,window:++seq,frames:ms.length,intervalP50Ms:pct(ms,.5),intervalP95Ms:pct(ms,.95),fps:+(1000*ms.length/dtSum).toFixed(1),bulletWorldP50Ms:pct(world,.5),gpuClothSteps:count,gpuSamples:gpu.length,clothGpuMsPerStepP50:pct(gpu,.5)};rows.push(r);if(rows.length>3600)rows.shift();ms=[];world=[];gpu=[];count=0;dtSum=0;epoch++;return r;}};
}
