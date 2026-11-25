import type {BufferGeometry, InstancedMesh} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {cameraInstancePrefix} from './cameraInstancePrefix';
import type {Part} from './SceneryBatch';

// These pool surfaces carry no texture. Share the identical lit vertices, not
// the normals across a cylinder rim or the colours on either side of a stripe.
export function indexPoolSurface(source:BufferGeometry){
  source.deleteAttribute('uv');
  const result=mergeVertices(source,1e-6);
  source.dispose();
  return result;
}

/** Keep the two opaque instance streams in one draw each. The separate tree
 * trunks precede the dense metalwork so looking back at the lawn needn't draw
 * 168 lane floats. Within the pool, run from the far pavilion to the entrance. */
export function poolInstanceStrips(items:Part[],prefix:Part[]=[]){
  const strips=new Map<number,Part[]>();
  for(const part of items){
    const k=Math.floor(part.p[2]/4),strip=strips.get(k);
    if(strip)strip.push(part);else strips.set(k,[part]);
  }
  const parts=prefix.slice(),ends=parts.length?[parts.length]:[];
  for(const [,strip] of [...strips].sort(([a],[b])=>a-b)){
    parts.push(...strip);ends.push(parts.length);
  }
  return {parts,onInstancesReady:(mesh:InstancedMesh)=>cameraInstancePrefix(mesh,ends)};
}
