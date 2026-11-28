import type {Vector3} from 'three';

/** A unit direction along the local sky, even when aiming straight up. */
export function horizonTangent(direction:Vector3,up:Vector3,out:Vector3){
  out.copy(direction).projectOnPlane(up);
  if(out.lengthSq()<.0001){const useX=Math.abs(up.x)<.8;out.set(useX?1:0,0,useX?0:1).projectOnPlane(up);}
  return out.normalize();
}
