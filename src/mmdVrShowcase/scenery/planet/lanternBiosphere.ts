import {Quaternion,Vector3} from 'three';
import {clearingRelief,lanternCentre,lanternRadius} from './lanternClearing';

export {lanternCentre,lanternRadius};
const unit=(x:number,y:number,z:number)=>new Vector3(x,y,z).normalize();
const north=new Vector3(0,1,0);
const ease=(a:number,b:number,v:number)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
export const lanternStation=unit(-.29,.825,-.485);
export const lanternTrail=[ [0,0],[-.87,-1.24],[-1.54,-1.91],[-3.47,-1.98],[-4.44,-.75] ] as const;

/** Distances in the landing's horizontal plan (only used in the northern garden). */
export function lanternPathDistance(x:number,z:number){
  let d=Infinity;
  for(let i=1;i<lanternTrail.length;i++){
    const [a,b]=lanternTrail[i-1],[c,e]=lanternTrail[i],dx=c-a,dz=e-b;
    const t=Math.min(1,Math.max(0,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz)));
    d=Math.min(d,Math.hypot(x-a-dx*t,z-b-dz*t));
  }
  return d;
}

// Chord distance to the closed north -> west quarter great circle, including
// the two endcaps (so its terrain taper never has a cut along an axis).
export function lanternWestDistance(x:number,y:number,z:number){
  const dot=x<=0&&y>=0?Math.sqrt(Math.max(0,1-z*z)):Math.max(y,-x);
  return lanternRadius*Math.sqrt(Math.max(0,2*(1-dot)));
}

/** The damp loam swells into folds, separated by the shallow beds of old cords.
 * These are metre-scale forms. Small pores and branching veins live in the print. */
export function lanternGround(x:number,y:number,z:number){
  const fold=4*x-3.1*y+3.4*z+1.18*Math.sin(3.1*z+2*y)+.64*Math.cos(4*x-y);
  const bed=Math.sin(fold),pillow=Math.cos(4.7*x-2.2*z+2*y)*Math.sin(3*z+2.3*y);
  const relief=.085+.21*pillow+.14*Math.cos(fold*1.8)-.19*Math.exp(-10*bed*bed);
  const nursery=x*lanternStation.x+y*lanternStation.y+z*lanternStation.z;
  const soft=1-ease(.970,.991,nursery);
  const westLanding=ease(1.12,1.74,lanternRadius*Math.sqrt(Math.max(0,2*(1+x))));
  const track=.34+.66*ease(.58,1.42,lanternWestDistance(x,y,z));
  return clearingRelief(x,y,z,relief*soft*(1-ease(.961,.982,y))*westLanding*track);
}

/** Moon-centred model position (the garden group carries the world translation). */
export const lanternLocal=(up:Vector3,h=0)=>up.clone().multiplyScalar(lanternRadius+lanternGround(up.x,up.y,up.z)+h);
export const lanternPoint=(up:Vector3,h=0)=>lanternLocal(up,h).add(lanternCentre);

// x/y/z are radial directions, then cap apex height, spread and signed stem lean in metres.
// The largest cap is behind the nursery, clear of both the walk and the performer platform.
const plots=[
  [.17,.655,-.737,3.02,1.48,-.18,.20],[-.68,.54,-.52,2.19,.96,.13,-.14],
  [-.69,.69,.24,1.91,.91,-.13,.09],[-.86,.38,.31,1.15,.61,-.08,.13],
  [.76,.61,-.21,2.35,1.11,.18,.07],[.82,.26,-.49,1.25,.69,.08,-.06],
  [.11,.39,.91,2.08,1.03,-.11,.14],[-.29,.38,.88,1.17,.65,.09,.12],
  [-.27,.08,-.96,1.94,.97,.12,.11],[-.64,-.28,-.71,1.37,.76,-.13,.03],
  [-.84,-.48,.22,2.01,.95,.11,.17],[-.55,-.59,.58,1.21,.62,-.1,.06],
  [.45,-.46,.77,2.27,1.01,.1,-.17],[.85,-.48,-.15,1.32,.78,-.12,.13],
  [-.19,-.91,-.36,1.94,.96,-.11,-.15],[.18,-.95,-.13,1.27,.61,.06,.1],
  [.437,.895,-.082,2.18,.89,-.075,.05],[-.145,.95,.272,1.87,.74,-.16,.06],
];
function plant(up:Vector3,h:number,r:number,dx:number,dz:number,i:number){
  const base=lanternLocal(up),q=new Quaternion().setFromUnitVectors(north,up);
  return {up,base,q,inverse:q.clone().invert(),h,r,dx,dz,phase:i*2.39996,lobes:7+i%3};
}
export const lanternTrees=plots.map(([x,y,z,h,r,dx,dz],i)=>plant(unit(x,y,z),h,r,dx,dz,i));
export type LanternTree=typeof lanternTrees[number];
export const lanternMother=lanternTrees[0];
export const lanternCup=lanternLocal(lanternStation,.50);

// The same scalloped envelope drives the painted veil, gills and sight check.
export function capRadius(s:LanternTree,a:number){
  return s.r*(1+.056*Math.cos(s.lobes*a+s.phase)+.038*Math.sin(3*a-s.phase)+.024*Math.cos(2*a));
}
export function capRoof(s:LanternTree,a:number,t:number){
  return s.h+s.r*(.052*Math.exp(-19*t*t)-.60*t*t+.115*ease(.74,1,t)
    +t*t*(.095*Math.sin(2*a+s.phase)+.043*Math.cos(s.lobes*a+s.phase))+.044*t*Math.cos(a));
}
export const gillDepth=(s:LanternTree,t:number)=>s.r*(.018+.16*(1-t)+.104*Math.sin(Math.PI*t));
export const capEdge=(s:LanternTree,a:number,t:number,y=0)=>{
  const rr=capRadius(s,a)*t;
  return new Vector3(s.dx+Math.cos(a)*rr,capRoof(s,a,t)+y,s.dz+Math.sin(a)*rr).applyQuaternion(s.q).add(s.base);
};
export const stemShape=(t:number,s:LanternTree)=>({
  x:s.dx*t*t+.072*s.r*Math.sin(Math.PI*t),z:s.dz*t*t-.046*s.r*Math.sin(Math.PI*t),
  r:s.r*(.112+.14*(1-t)**5+.061*t**4),
});

// A flush puts a broad first fruit above a few younger, overlapping caps. The
// roots follow the real hill individually; no single tangent slab floats off it.
// The first two flank the level stage, 2–4 descend from the pleated grove.
const flushes=[[-.21,.95,.23,.91,.38],[.31,.914,-.263,.94,2.46],[-.53,.68,-.51,.94,1.0],
  [-.74,.39,-.547,1.03,2.7],[-.60,.29,-.74,.79,1.4],[-.25,.17,-.95,.91,.6],[-.85,.05,-.526,1.03,2.1],
  [.38,.81,-.44,.78,1.9],[.77,.49,-.37,.87,1.21],[.56,.51,.65,.97,.5],[-.36,.56,.74,.75,1.38],
  [.18,.14,-.97,.85,2.8],[-.54,-.64,.56,.86,.87],[.37,-.85,-.37,.83,1.40]];
const buds=[[0,0,.89,.47],[-.51,-.13,.59,.36],[.49,.11,.64,.41],[.22,-.41,.39,.31],[-.29,.27,.32,.245]];
export const lanternFlushes=flushes.map(([x,y,z,scale,yaw],i)=>{
  const n=unit(x,y,z),q=new Quaternion().setFromUnitVectors(north,n),centre=lanternLocal(n,.45),caps:LanternTree[]=[];
  const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const [j,[a,b,h,r]] of buds.entries()){
    const direction=new Vector3(scale*(a*c-b*s),lanternRadius,scale*(a*s+b*c)).applyQuaternion(q).normalize();
    const spread=r*scale*1.15+.045;
    if(!lanternCanPlant(direction,spread))continue;
    const cap=plant(direction,scale*h,scale*r,(j-2)*.016,.025*Math.sin(i),i*buds.length+j);
    const top=cap.base.clone().addScaledVector(cap.up,cap.h);
    if(direction.y>.38&&(Math.hypot(top.x-1.65,top.z-1.85)<1.65+spread||lanternPathDistance(top.x,top.z)<.64+spread))continue;
    // Leave the major stems visible through the family, including their foot flares.
    if(lanternTrees.some(t=>cap.base.distanceTo(t.base)<t.r*.28+spread*.72))continue;
    caps.push(cap);
  }
  const reach=caps.reduce((m,t)=>Math.max(m,centre.distanceTo(t.base)+t.h+t.r*1.18),0);
  return {centre,reach,caps};
}).filter(f=>f.caps.length>0);

const local=new Vector3(),body=new Vector3();
export function lanternTrunkBlocks(world:Vector3,r:number,height:number){
  body.copy(world).sub(lanternCentre);
  for(const s of lanternTrees){
    local.copy(body).sub(s.base).applyQuaternion(s.inverse);
    const top=s.h-.14*s.r;
    if(local.y>top||local.y+height<-.09||Math.abs(local.x)>.6*s.r+r||Math.abs(local.z)>.6*s.r+r)continue;
    const lo=Math.max(0,Math.min(1,local.y/top)),hi=Math.max(0,Math.min(1,(local.y+height)/top));
    for(const t of [lo,(lo+hi)*.5,hi]){const p=stemShape(t,s);
      if(Math.hypot(local.x-p.x,local.z-p.z)<r+1.08*p.r)return true;}
  }
  for(const bed of lanternFlushes){if(body.distanceToSquared(bed.centre)>(bed.reach+r+height)**2)continue;
    for(const s of bed.caps){local.copy(body).sub(s.base).applyQuaternion(s.inverse);
      if(local.y>s.h+.06*s.r||local.y+height<-.035)continue;
      const dx=local.x-s.dx,dz=local.z-s.dz,d=Math.hypot(dx,dz);
      if(d<r+s.r*.24&&local.y<s.h-.10*s.r)return true;
      const a=Math.atan2(dz,dx),spread=capRadius(s,a);if(d>spread+r)continue;
      const t=Math.min(1,d/spread),roof=capRoof(s,a,t);
      if(local.y<=roof+.025&&local.y+height>=roof-gillDepth(s,t)-.025)return true;}}
  return false;
}
function inCanopy(s:LanternTree){
  local.copy(body).sub(s.base).applyQuaternion(s.inverse);
  if(local.y<s.h-.86*s.r||local.y>s.h+.08*s.r)return false;
  const dx=local.x-s.dx,dz=local.z-s.dz,a=Math.atan2(dz,dx),t=Math.hypot(dx,dz)/capRadius(s,a);
  if(t>1.015)return false;
  const roof=capRoof(s,a,t);
  return local.y<=roof+.035&&local.y>=roof-gillDepth(s,Math.min(1,t))-.035;
}
export function lanternCanopyBlocks(world:Vector3){
  body.copy(world).sub(lanternCentre);
  if(lanternTrees.some(inCanopy))return true;
  for(const f of lanternFlushes)if(body.distanceToSquared(f.centre)<f.reach**2&&f.caps.some(inCanopy))return true;
  return false;
}

/** Ground cover only: the pole, actor deck, nursery bowl and footpath stay empty. */
export function lanternCanPlant(up:Vector3,spread:number){
  if(lanternRadius*Math.sqrt(Math.max(0,2*(1+up.x)))<1.16+spread)return false;
  if(lanternWestDistance(up.x,up.y,up.z)<.57+spread)return false;
  if(up.y<.38)return true;
  const p=lanternLocal(up);
  return Math.hypot(p.x,p.z)>1.18+spread&&Math.hypot(p.x-1.65,p.z-1.85)>1.76+spread
    &&p.distanceTo(lanternLocal(lanternStation))>.57+spread&&lanternPathDistance(p.x,p.z)>.64+spread;
}

// A seed really leaves the downwind side of the mother and lands in the open cup.
const seedBearing=lanternCup.clone().sub(lanternMother.base).applyQuaternion(lanternMother.inverse);
export const lanternSeedStart=capEdge(lanternMother,Math.atan2(seedBearing.z,seedBearing.x),.87,-.11);
export function lanternSeedPosition(t:number,lane:number,out:Vector3){
  const wave=Math.sin(Math.PI*t),swirl=lane*2.39996+5*t;
  return out.lerpVectors(lanternSeedStart,lanternCup,t).addScaledVector(lanternStation,wave*(.26+.12*Math.cos(swirl)))
    .setX(out.x+.20*wave*Math.sin(swirl)).setZ(out.z+.31*wave*Math.cos(swirl));
}

const tuple=(v:Vector3)=>v.toArray() as [number,number,number];
const eye=(v:Vector3,h:number)=>tuple(lanternPoint(v,h));
const northAisle=unit(-.33,.943,-.028),leafBed=unit(-.65,.747,-.13);
const lamp=lanternTrees[1],groveEye=lanternLocal(leafBed,1.19),face=groveEye.clone().sub(lamp.base).applyQuaternion(lamp.inverse);
face.y=0;face.normalize();const groveAim=lamp.base.clone().addScaledVector(lamp.up,1.01).addScaledVector(face.applyQuaternion(lamp.q),.13);
groveAim.addScaledVector(new Vector3().subVectors(groveAim,groveEye).cross(leafBed).normalize(),.51);
export const lanternViews={
  globe:{eye:tuple(lanternCentre.clone().add(new Vector3(-9.8,14.6,-11.6))),aim:tuple(lanternCentre.clone().add(new Vector3(-.35,.54,-.45)))},
  nursery:{eye:eye(northAisle,1.45),aim:tuple(lanternCup.clone().lerp(lanternSeedStart,.47).add(lanternCentre)),up:tuple(northAisle)},
  grove:{eye:tuple(groveEye.add(lanternCentre)),aim:tuple(groveAim.add(lanternCentre)),up:tuple(leafBed)},
};
