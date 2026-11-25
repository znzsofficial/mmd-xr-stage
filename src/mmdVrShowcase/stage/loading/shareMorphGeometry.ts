import type {BufferGeometry, Object3D, SkinnedMesh} from 'three';

type Range={start:number;count:number};
function sameEntries(a:Record<string,unknown>,b:Record<string,unknown>){
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>a[k]===b[k]);
}

/** The 0.8.6 loader creates a geometry shell per draw, referencing the same
 * attributes. Three owns its morph texture per BufferGeometry, NOT per set of
 * attributes. Backport the range-scoped draws of upstream 3f3c82a here, at
 * the page's preparation boundary, before the first upload or raycast. */
export function shareMorphGeometry(root:Object3D){
  const sources:SkinnedMesh[]=[],proxies:SkinnedMesh[]=[];
  root.traverse(o=>{
    const m=o as SkinnedMesh;if(!m.isSkinnedMesh)return;
    const morph=m.geometry.morphAttributes;if(!morph.position?.length&&!morph.normal?.length&&!morph.color?.length)return;
    if(m.userData.mmdMaterialRenderProxy||m.userData.mmdOutlineProxy)proxies.push(m);
    else if(m.userData.mmdModel||m.userData.mmdMorphSplitBody)sources.push(m);
  });
  for(const proxy of proxies){
    if(Array.isArray(proxy.material))continue;
    const old=proxy.geometry,meta=proxy.userData.mmdMaterialRenderProxy??proxy.userData.mmdOutlineProxy;
    // A newer loader (or a second preparation of this rig) owns the hooks
    // already. Never rebase a compact split onto the unsplit source.
    if(sources.some(m=>m.geometry===old))continue;
    const {start,count}=old.drawRange,slot=meta.materialIndex??meta.sourceMaterialIndex;
    const source=sources.find(m=>m.skeleton===proxy.skeleton&&m.geometry.index===old.index&&
      m.geometry.attributes.position===old.attributes.position&&m.geometry.morphTargetsRelative===old.morphTargetsRelative&&
      m.geometry.groups.some(g=>g.materialIndex===slot&&g.start===start&&g.count===count)&&
      sameEntries(m.geometry.attributes,old.attributes)&&sameEntries(m.geometry.morphAttributes,old.morphAttributes));
    if(!source)continue;
    // The old shell has never been uploaded. Its arrays are still owned by
    // source; release only the reference, not shared attributes or materials.
    meta.start=start;meta.count=count;proxy.geometry=source.geometry;
    scopeDraws(proxy,source.geometry,{start,count});
  }
}

function scopeDraws(proxy:SkinnedMesh,geometry:BufferGeometry,range:Range){
  const saved:Range[]=[];
  const enter=()=>{saved.push(geometry.drawRange);geometry.drawRange=range;};
  const exit=()=>{geometry.drawRange=saved.pop()!;};
  const before=proxy.onBeforeRender,after=proxy.onAfterRender,beforeShadow=proxy.onBeforeShadow,afterShadow=proxy.onAfterShadow,ray=proxy.raycast;
  proxy.onBeforeRender=function(...args){before.apply(this,args);enter();};
  proxy.onAfterRender=function(...args){exit();after.apply(this,args);};
  proxy.onBeforeShadow=function(...args){beforeShadow.apply(this,args);enter();};
  proxy.onAfterShadow=function(...args){exit();afterShadow.apply(this,args);};
  proxy.raycast=function(...args){enter();try{ray.apply(this,args);}finally{exit();}};
}
