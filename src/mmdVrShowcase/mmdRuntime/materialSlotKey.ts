import type { Material, Object3D } from 'three';

/** UI, snapshots, body splits and render/outline proxies all address the
 * authored material slot, not a display mesh's name or sorted draw order. */
export function materialSlotKey(material:Pick<Material,'name'>|null|undefined,index:number){
  return material?.name?.trim()||`Material ${index+1}`;
}

export function sourceMaterialSlot(owner:Object3D,source:readonly Material[],material:Material,localIndex:number){
  const d=owner.userData,i=d.mmdMaterialRenderProxy?.materialIndex??d.mmdOutlineProxy?.sourceMaterialIndex??d.mmdMorphSplitBody?.materialIndex;
  if(Number.isInteger(i)&&i>=0&&i<source.length)return i as number;
  const shared=source.indexOf(material);return shared>=0?shared:localIndex;
}
