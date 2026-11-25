import type { Mesh } from 'three';

/** Outside a draw, shared geometry has the source or split body's range.
 * Older loader proxies keep their own range on a separate geometry. */
export function modelDrawRange(mesh:Mesh):Readonly<{start:number;count:number}>{
  const {mmdMaterialRenderProxy,mmdOutlineProxy}=mesh.userData;
  for(const proxy of [mmdMaterialRenderProxy,mmdOutlineProxy]){
    const start=proxy?.start,count=proxy?.count;
    if(Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(count)&&count>=0)return {start,count};
  }
  return mesh.geometry.drawRange;
}
