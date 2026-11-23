import {Vector3} from 'three';
import {allMoons,type WalkMoon} from './windAtlas';
import {moonRadius} from './moonSurface';

export const leapNames={salt:['棱盐星','Halite'],glaze:['玄釉星','Obsidian'],mica:['云母屿','Mica'],sulfur:['硫珠屿','Sulfur'],lantern:['伞灯星','Lantern'],amber:['琥珀屿','Amber']} as const;
type LeapId=keyof typeof leapNames;
const world=(id:LeapId)=>allMoons.find(m=>m.id===id)!;
function endpoint(id:LeapId,moon:WalkMoon,up:Vector3){
  return {id,moon,up,foot:moon.centre.clone().addScaledVector(up,moonRadius(moon,up.x,up.y,up.z))};
}
function crossing(a:LeapId,b:LeapId){
  const from=world(a),to=world(b),axis=to.centre.clone().sub(from.centre).normalize();
  const left=endpoint(a,from,axis),right=endpoint(b,to,axis.clone().negate());
  const crest=new Vector3(0,1,0).projectOnPlane(axis).normalize(),sight=new Vector3().crossVectors(crest,axis);
  return [{pad:left,target:right,crest,sight},{pad:right,target:left,crest,sight}];
}
// Each end gets its own trigger and the reciprocal landing, even when two
// different crossings depart the same world. No nearest-centre capture.
const twinRoutes=crossing('salt','glaze');
export const leapRoutes=[...twinRoutes,...crossing('glaze','mica'),...crossing('mica','sulfur'),...crossing('lantern','amber')];
export type LeapRoute=typeof leapRoutes[number];
export const TWIN_PAD_RADIUS=.68;
export function twinPad(moon:WalkMoon){return twinRoutes.find(r=>r.pad.moon===moon)?.pad;}
export function leapAt(moon:WalkMoon,foot:Vector3){return leapRoutes.find(r=>r.pad.moon===moon&&r.pad.foot.distanceToSquared(foot)<=TWIN_PAD_RADIUS**2);}
