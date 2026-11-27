import type { SkinnedMesh } from 'three';
import { create } from 'zustand';
import { authoredSurface } from './authoredSurface';

export type WandResponse = { morph:string|null; strength:number };
export const defaultWandResponse: Readonly<WandResponse> = { morph:null, strength:.65 };
export const useWandResponse = create<{ enabled:boolean; byActor:Record<string,WandResponse> }>(()=>({ enabled:true, byActor:{} }));
export const setWandResponseEnabled = (enabled:boolean) => useWandResponse.setState({enabled});
export function setWandResponse(runtimeId:string, morph:string|null, strength:number) {
  if(!runtimeId) return;
  useWandResponse.setState(s=>({byActor:{...s.byActor,[runtimeId]:{morph,
    strength:Number.isFinite(strength)?Math.max(0,Math.min(1,strength)):defaultWandResponse.strength}}}));
}

export function forgetWandResponses(ids:readonly string[]) {
  const {byActor}=useWandResponse.getState();
  if(!ids.some(id=>Object.hasOwn(byActor,id)))return;
  const next={...byActor}; for(const id of ids)delete next[id];
  useWandResponse.setState({byActor:next});
}

/** Only list weights with a rendered vertex channel. Bone/material/group PMX
 * morphs require re-running the evaluator and aren't display-only weights. */
export function wandMorphNames(source:SkinnedMesh):readonly string[] {
  if(source.userData.mmdOutline || source.userData.mmdOutlineProxy || source.userData.mmdMaterialRenderProxy || source.userData.mmdMorphSplitBody)return [];
  const valid=new Set<number>(authoredSurface.get(source)?.morphIndices);
  const bodies:SkinnedMesh[]=source.userData.mmdMorphSplitBodyMeshes??[source];
  for(const body of bodies){
    const attrs=body.geometry.morphAttributes.position??[], map=body.userData.mmdMorphSplitBody?.morphTargetIndices;
    for(let i=0;i<attrs.length;i++)if(attrs[i])valid.add(map?.[i]??i);
  }
  const meta=source.userData.mmdMorphs;
  const seen=new Set<number>();
  return Object.entries(source.morphTargetDictionary??{}).filter(([,i])=>{
    if(!valid.has(i) || (meta?.[i] && meta[i].type!=='vertex') || seen.has(i))return false;
    seen.add(i);return true;
  }).map(([name])=>name);
}
