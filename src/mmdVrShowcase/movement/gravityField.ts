import type {Vector3} from 'three';
import type {SceneryId} from '../scenery/catalog';
import {allMoons,type WalkMoon} from '../scenery/planet/windAtlas';
import {homeWorld,ROOM_GRAVITY} from './gravityReference';

export {homeWorld} from './gravityReference';
export type World=typeof homeWorld|WalkMoon;
// Finite, walkable bodies only. Keep the atlas identities used by landing and travel.
export const walkWorlds:readonly World[]=[homeWorld,...allMoons];

const gap=(w:World,p:Vector3)=>p.distanceTo(w.centre)-w.radius;
const reach=(w:World)=>4+w.radius*1.8;

/** A nearby well can acquire; in an overlap the challenger must beat the
 * previous nominal surface distance by 0.55 m. No shared active world. */
export function localWell(p:Vector3,previous:World|null):World|null{
  let best=previous&&gap(previous,p)<reach(previous)+1?previous:null;
  let score=best?gap(best,p)-.55:Infinity;
  for(const w of walkWorlds){
    const d=gap(w,p);
    if(d<score&&d<reach(w)){best=w;score=d;}
  }
  return best;
}

export function pull(w:World|null,p:Vector3,out:Vector3){
  if(!w)return out.set(0,0,0);
  out.subVectors(w.centre,p);
  const r=out.length(),d=r-w.radius;
  // Keep lunar hops calibrated close to the surface. Farther out the field
  // follows inverse square and fades smoothly over the outermost two metres.
  const reference=w.radius+(w.id==='home'?0:1.25),fade=Math.min(1,Math.max(0,(reach(w)-d)/2));
  return out.multiplyScalar(w.surfaceGravity*(reference/Math.max(reference,r))**2*fade*fade*(3-2*fade)/Math.max(r,1e-9));
}

/** Sample world-space acceleration (m/s²) at this object's point. Pass its
 * last returned well, or null at spawn. Only out is written; no physics step. */
export function sampleStageGravity(room:SceneryId,point:Vector3,previous:World|null,out:Vector3):World|null{
  if(room!=='glassPlanet'){out.set(0,-ROOM_GRAVITY,0);return null;}
  const w=localWell(point,previous);
  pull(w,point,out);
  return w;
}
