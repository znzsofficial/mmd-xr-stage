import {Matrix4,Quaternion,Vector3} from 'three';
import {surveyOccupancy} from './surveyOccupancy';
import {moonRadius} from './moonSurface';
import {crustRadius} from './opalTerrain';
import {PLANET_RADIUS} from './planetLayout';
import {lanes,type WalkMoon,type WindLane} from './windAtlas';

export type WindTerminalWorld='home'|WalkMoon['id'];
export type WindTerminalBox=Readonly<{center:Vector3;half:Vector3;rotation:Quaternion}>;
export const windFace={width:.96,height:.39,tilt:-.14,z:.058,y:1.22} as const;
const north=new Vector3(0,1,0),homeCentre=new Vector3(0,-PLANET_RADIUS,0);

/** Height along the nozzle axis at a point in its tangent plane. A radial
 * height at the port *centre* misses the rising shoulder around the deck.
 * Intersect the displaced shell along the actual mounting axis. */
export function windFloor(lane:WindLane,back:boolean,point:Vector3,facet?:(x:number,y:number,z:number)=>number){
  const port=back?lane.away:lane.home,centre=back?lane.moon.centre:homeCentre;
  const x=point.x-centre.x,y=point.y-centre.y,z=point.z-centre.z,u=port.up;
  let h=0;
  for(let i=0;i<8;i++){
    const a=x+h*u.x,b=y+h*u.y,c=z+h*u.z,r=Math.hypot(a,b,c);
    const surface=facet?facet(a/r,b/r,c/r):back?moonRadius(lane.moon,a/r,b/r,c/r):crustRadius(a/r,b/r,c/r);
    const dh=(surface-r)*r/(a*u.x+b*u.y+c*u.z);h+=dh;if(Math.abs(dh)<.0002)break;
  }
  return h;
}

// Keep the home boards on the far rim as seen from the compass; the collar
// and the read face are in one sightline. At the return end, leave the walk
// to the instrument, clearing, or cave open. Reed skirts the meridian nails.
const returnFront:Record<WindLane['moon']['id'],readonly [number,number]>={
  ember:[.51,-.36],frost:[-.48,-.36],salt:[.41,.49],glaze:[.707,.707],
  reed:[.90,.40],lantern:[-.65,.76],tide:[1,0],
};
function terminal(lane:WindLane,back:boolean){
  const port=back?lane.away:lane.home,up=port.up,[x,z]=returnFront[lane.moon.id];
  const front=back?new Vector3(x,0,z):new Vector3(-up.x,0,-up.z);
  front.projectOnPlane(up).normalize();
  if(!back&&lane.moon.id==='reed')front.applyAxisAngle(up,-.60);
  const right=new Vector3().crossVectors(up,front),rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,front));
  const base=port.foot.clone().addScaledVector(front,-1.42);
  base.addScaledVector(up,windFloor(lane,back,base));
  const local=(x:number,y:number,z:number)=>new Vector3(x,y,z).applyQuaternion(rotation).add(base);
  const face=local(0,windFace.y,windFace.z),faceRotation=rotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),windFace.tilt));
  // Feet/spine/head are separate, with the head aligned to its tilted glass.
  // Its front stops 2 mm behind the printed plane; no own-cabinet exemption.
  const boxes:readonly WindTerminalBox[]=[
    {center:local(0,0,-.038),half:new Vector3(.205,.25,.16),rotation},
    {center:local(0,.676,-.055),half:new Vector3(.106,.438,.084),rotation},
    {center:new Vector3(0,0,-.0505).applyQuaternion(faceRotation).add(face),half:new Vector3(.516,.229,.0485),rotation:faceRotation},
  ];
  const mount=new Vector3().subVectors(base,port.foot).applyQuaternion(rotation.clone().invert());
  return {lane,back,port,world:back?lane.moon.id:'home' as const,base,mount,rotation,front,face,faceRotation,boxes};
}
export type WindTerminal=ReturnType<typeof terminal>;
export const windTerminals:readonly WindTerminal[]=lanes.flatMap(l=>[terminal(l,false),terminal(l,true)]);

const occupied=new Map<WindTerminalWorld,ReturnType<typeof surveyOccupancy>>();
for(const world of new Set(windTerminals.map(t=>t.world)))
  occupied.set(world,surveyOccupancy(windTerminals.filter(t=>t.world===world).flatMap(t=>t.boxes)));
const d=new Vector3();
export function windTerminalBlocks(p:Vector3,r:number,h:number,world:WindTerminalWorld,up?:Vector3){
  const site=windTerminals.find(t=>t.world===world);if(!site)return false;
  if(up)d.copy(up);else d.subVectors(p,site.back?site.lane.moon.centre:homeCentre);
  return occupied.get(world)!(p,d.normalize(),h,r);
}
export function windTerminalOccludes(from:Vector3,to:Vector3,world:WindTerminalWorld){
  d.subVectors(to,from);const len=d.length();return occupied.get(world)?.(from,d.normalize(),len,0)??false;
}
