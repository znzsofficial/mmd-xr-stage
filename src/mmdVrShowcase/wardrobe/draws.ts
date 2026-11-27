import type { Material, SkinnedMesh } from 'three';
import { sourceMaterialSlot } from '../mmdRuntime/materialSlotKey';
import type { MaterialPipelineEntry } from '../mmdRuntime/mmdRuntimeMaterials';

// The loader authors visibility and opacity again on every evaluation (including
// edge and shadow-only draws). Compose the user's multiplier ON TOP of those
// values, then unwind before the next evaluation. No shader/texture cloning.
type Draw={name:string; mat:Material; multiplier:number; visible:boolean; rawVisible:boolean; rawAlpha:number; rawBlend:boolean; rawDepth:boolean; edgeAlpha?:{value:number};rawEdgeAlpha:number};
type Layer={all:Draw[]; edited:Draw[]; applied:boolean;revision:number};
const layers=new WeakMap<SkinnedMesh,Layer>();
export const drawRevision=(mesh:SkinnedMesh)=>layers.get(mesh)?.revision??0;
export function invalidateDraws(mesh:SkinnedMesh){const layer=layers.get(mesh);if(layer)layer.revision++;}
function indexDraws({model,materialNames}:MaterialPipelineEntry):Layer {
  const source=[model.mesh.material].flat(),all:Draw[]=[],seen=new Set<Material>();
  function add(mat:Material,index:number){
    if(!mat||seen.has(mat))return;seen.add(mat);
    const edge=mat.userData.mmdTslOutlineMaterial;
    all.push({mat,name:materialNames[edge?.sourceMaterialIndex??index],visible:true,multiplier:1,rawVisible:true,rawAlpha:1,
      rawBlend:false,rawDepth:true,edgeAlpha:edge?.uniforms?.opacity,rawEdgeAlpha:1});
  }
  source.forEach(add);
  for(const owner of [...(model.mesh.userData.mmdMorphSplitBodyMeshes??[]),...(model.renderOrderMeshes??[]),...(model.outlineMeshes??[])] as SkinnedMesh[])
    [owner.material].flat().forEach((mat,i)=>add(mat,sourceMaterialSlot(owner,source,mat,i)));
  return {all,edited:[],applied:false,revision:0};
}
export function restoreDraws(mesh:SkinnedMesh){
  const layer=layers.get(mesh);if(!layer?.applied)return;
  for(const d of layer.edited){const m=d.mat;m.visible=d.rawVisible;m.opacity=d.rawAlpha;m.transparent=d.rawBlend;m.depthWrite=d.rawDepth;
    if(d.edgeAlpha)d.edgeAlpha.value=d.rawEdgeAlpha;}
  layer.applied=false;
}
export function presentDraws(mesh:SkinnedMesh){
  const layer=layers.get(mesh);if(!layer||layer.applied||!layer.edited.length)return;
  for(const d of layer.edited){const m=d.mat;
    d.rawVisible=m.visible;d.rawAlpha=m.opacity;d.rawBlend=m.transparent;d.rawDepth=m.depthWrite;
    if(d.edgeAlpha){d.rawEdgeAlpha=d.edgeAlpha.value;d.edgeAlpha.value*=d.multiplier;}
    if(!d.visible||d.multiplier===0)m.visible=false;
    if(d.multiplier<1){m.opacity*=d.multiplier;m.transparent=true;m.depthWrite=false;}
  }
  layer.applied=true;
}
export function configureDraws(entry:MaterialPipelineEntry){
  const mesh=entry.model.mesh;let layer=layers.get(mesh);
  if(!layer){layer=indexDraws(entry);layers.set(mesh,layer);}
  restoreDraws(mesh);layer.edited.length=0;layer.revision++;
  for(const d of layer.all){d.visible=entry.materialVisible[d.name]!==false;
    const multiplier=entry.materialOverrides[d.name]?.opacity??1;
    // r187 bakes an opaque fragment's alpha to 1. Invalidate on entry to
    // and exit from the editable blend path, never per pose or slider tick.
    if(d.mat.userData.stageMaterial&&(d.multiplier<1)!==(multiplier<1))d.mat.needsUpdate=true;
    d.multiplier=multiplier;
    if(!d.visible||d.multiplier!==1)layer.edited.push(d);}
  entry.model.root.visible=entry.visible;presentDraws(mesh);
}
