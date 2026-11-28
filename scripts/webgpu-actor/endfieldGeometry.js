import { hasAuthoredEdge, outlineHeadBones } from './endfieldOutlineBake.js';
import { fingerSegments } from './skinTransmissionBake.js';

// Immutable byte snapshots, not live BufferAttributes. TSL can replace
// positions/UVs and add groups; a dense pose edit can also write in place.
// Blob mail survives worker failure without detaching any renderer input.
export function captureEndfieldGeometry(mesh,roles,skin,{smoothOutline,pmxBytes,pmxFile}) {
  const g=mesh.geometry, a=g.attributes, materials=[mesh.material].flat();
  if (a.position.isStorageBufferAttribute || mesh.userData.mmdTslSparsePositionMorphs ||
      materials.some(m=>m.userData.mmdTslMaterialUniforms)) throw Error('Capture style geometry before TSL attachment');
  const edges=materials.map(m=>hasAuthoredEdge(m.userData.mmdMaterial));
  const outline=smoothOutline!==false && [...roles.keys()].some(i=>edges[i]) &&
    a.normal?.count===a.position.count && !g.morphAttributes.normal?.length;
  // The measured cost is the outline's topology proof. A skin-only actor
  // keeps its small eager mask; don't start a worker and retain a mesh copy
  // just for that mask. With neither pass, there is nothing to capture.
  if(!outline)return skin.length ? undefined : null;
  const fingers=skin.length && a.skinIndex && a.skinWeight ? fingerSegments(mesh) : null;
  // The stage asks for sparse PMX. Keep the eager bake for custom or dense
  // layouts rather than snapshotting an entire morph atlas.
  if (g.morphAttributes.position?.length) return undefined;
  const attrs={};
  for(const name of ['position','skinIndex','skinWeight','normal','uv','mmdEdgeScale','matricesSdefEnabled','matricesQdefEnabled','index']) {
    const attr=name==='index' ? g.index : a[name];
    if(!attr)continue;
    const array=attr.array;
    if(attr.isInterleavedBufferAttribute || attr.isFloat16BufferAttribute ||
      !(array instanceof Float32Array || array instanceof Uint32Array || array instanceof Uint16Array || array instanceof Uint8Array))return undefined;
    attrs[name]={bytes:new Blob([array]),type:array.constructor.name,itemSize:attr.itemSize,normalized:attr.normalized};
  }
  const morphs=mesh.userData.mmdMorphs?.map(({type})=>({type}));
  const hasPositionMorphs=morphs ? morphs.some(m=>['vertex','base','unknown'].includes(m.type)) : !!mesh.morphTargetInfluences?.length;
  return {attrs,groups:g.groups.map(({start,count,materialIndex})=>({start,count,materialIndex})),
    roles,edges,headBones:outlineHeadBones(mesh),
    morphs,influences:mesh.morphTargetInfluences?.length??0,
    pmx:hasPositionMorphs && pmxBytes ? pmxFile??new Blob([pmxBytes]) : null,
    skin,fingers};
}

const createWorker=()=>new Worker(new URL('./endfieldGeometry.worker.js',import.meta.url),{type:'module'});

export function readEndfieldGeometry(evidence,signal,workerFor=createWorker) {
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const worker=workerFor();
    function retire(){
      worker.onerror=worker.onmessageerror=worker.onmessage=null;
      signal.removeEventListener('abort',abort);worker.terminate();
    }
    function abort(){retire();reject(signal.reason);}
    function fail(){retire();reject(Error('Could not bake optional style geometry'));}
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=worker.onmessageerror=e=>{e.preventDefault?.();fail();};
    worker.onmessage=({data})=>{retire();if(data.failed)reject(Error('Unsupported style geometry'));else resolve(data);};
    try {worker.postMessage(evidence);} catch(error){retire();reject(error);}
  });
}
