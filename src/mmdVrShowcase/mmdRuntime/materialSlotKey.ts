import type { Material, Object3D } from 'three';

/** UI, snapshots, body splits and render/outline proxies all address the
 * authored material slot, not a display mesh's name or sorted draw order. */
export function materialSlotKeys(materials:readonly (Pick<Material,'name'>|null|undefined)[]){
  const names=materials.map((m,i)=>m?.name?.trim()||`Material ${i+1}`),counts=new Map<string,number>();
  for(const name of names)counts.set(name,(counts.get(name)??0)+1);
  const reserved=new Set(names);
  return names.map((name,i)=>{
    if(counts.get(name)===1&&!(name in Object.prototype))return name;
    // Source order survives render sorting, splits and reloads. A real PMX
    // name can itself look like a generated suffix; never alias that slot.
    let key=`${name} [#${i+1}]`;while(reserved.has(key))key+='#';
    reserved.add(key);return key;
  });
}

export function sourceMaterialSlot(owner:Object3D,source:readonly Material[],material:Material,localIndex:number){
  const d=owner.userData,i=d.mmdMaterialRenderProxy?.materialIndex??d.mmdOutlineProxy?.sourceMaterialIndex??d.mmdMorphSplitBody?.materialIndex;
  if(Number.isInteger(i)&&i>=0&&i<source.length)return i as number;
  const shared=source.indexOf(material);return shared>=0?shared:localIndex;
}
