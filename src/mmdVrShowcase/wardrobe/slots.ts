import type { Material, SkinnedMesh, Texture } from 'three';
import { materialSlotKeys, sourceMaterialSlot } from '../mmdRuntime/materialSlotKey';
import { modelDrawRange } from '../mmdRuntime/modelDrawRange';

export type ModelDraws={renderOrderMeshes?:readonly SkinnedMesh[];outlineMeshes?:readonly SkinnedMesh[]};
type Mapped=Material & {map:Texture|null};
type Wire=Material & {wireframe:boolean};
export type ClothingSlot={index:number;key:string;label:string;triangles:number;textured:boolean};
export type SlotBinding=ClothingSlot & {source:Material;maps:Mapped[];wires:Wire[]};

/** Enumerate actual colour draws, including compact body groups and render
 * proxies when the logical source draws zero indices. Visibility is an edit,
 * not topology: a previously hidden slot must remain findable. */
export function bindSlots(mesh:SkinnedMesh,model:ModelDraws={}):SlotBinding[]{
  const source=[mesh.material].flat(),keys=materialSlotKeys(source),slots=new Map<number,SlotBinding>();
  const bodies=[mesh,...(mesh.userData.mmdMorphSplitBodyMeshes??[]) as SkinnedMesh[],...(model.renderOrderMeshes??[])];
  const addMap=(slot:SlotBinding,m?:Material)=>{
    if(m&&'map' in m&&m.map&&(m.map as Texture).isTexture&&!slot.maps.includes(m as Mapped))slot.maps.push(m as Mapped);
  };
  for(const owner of new Set(bodies)){
    const g=owner.geometry,total=g.index?.count??g.attributes.position?.count??0,r=modelDrawRange(owner);
    const draw=(mat:Material|undefined,local:number,start:number,end:number)=>{
      const n=Math.floor((Math.min(total,r.start+r.count,end)-Math.max(0,r.start,start))/3);
      if(!mat||n<=0||!Number.isFinite(n)||mat.userData.mmdShadowOnlyRenderProxy||!mat.colorWrite)return;
      const i=sourceMaterialSlot(owner,source,mat,local),m=source[i];if(!m)return;
      // The PMX loader gives different authored slots distinct materials even
      // if their maps/names match. Do not offer unsafe edits on an aliased mesh.
      if(source.indexOf(m)!==source.lastIndexOf(m))return;
      let s=slots.get(i);if(!s){const key=keys[i];slots.set(i,s={index:i,key,label:key,source:m,triangles:0,textured:false,maps:[],wires:[]});}
      s.triangles+=n;if('wireframe' in mat&&!s.wires.includes(mat as Wire))s.wires.push(mat as Wire);
      addMap(s,mat);addMap(s,m);
      const map=(mat as Mapped).map;
      if(map?.isTexture&&g.getAttribute(map.channel?`uv${map.channel}`:'uv'))s.textured=true;
    };
    if(Array.isArray(owner.material))for(const group of g.groups){const i=group.materialIndex??0;draw(owner.material[i],i,group.start,group.start+group.count);}
    else draw(owner.material,0,0,total);
  }
  // PMX outlines are intentionally flat. Only map-bearing shadow passes and
  // depth helpers of this slot track the base-colour replacement.
  for(const owner of bodies){
    const mats=[owner.material].flat();
    for(const [j,m] of mats.entries()){
      if(!m)continue;const i=sourceMaterialSlot(owner,source,m,j),s=slots.get(i);if(!s)continue;
      if(m.userData.mmdShadowOnlyRenderProxy)addMap(s,m);
      if(mats.length===1||owner.userData.mmdMorphSplitBody?.materialIndex===j){
        addMap(s,owner.customDepthMaterial);addMap(s,owner.customDistanceMaterial);
      }
    }
  }
  return [...slots.values()].sort((a,b)=>a.index-b.index);
}

// A garment guard already mounted before a user saves a missing piece must
// see that change. Replacing the Set invalidates only that actor's topology.
const manualGarments=new WeakMap<SkinnedMesh,ReadonlySet<string>>();
export function publishGarmentKeys(mesh:SkinnedMesh,keys:Iterable<string>){const next=new Set(keys);if(next.size)manualGarments.set(mesh,next);else manualGarments.delete(mesh);}
export function garmentKeys(mesh:SkinnedMesh){return manualGarments.get(mesh);}
