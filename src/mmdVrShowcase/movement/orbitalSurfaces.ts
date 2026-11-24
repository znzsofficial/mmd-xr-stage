import {Vector3} from 'three';
import {moonRadius,moonSegments} from '../scenery/planet/moonSurface';
import {facetSampler} from '../scenery/planet/shellFacets';
import {allMoons} from '../scenery/planet/windAtlas';
import {homeShellRadius} from './homeSurface';
import {homeWorld,walkWorlds,type World} from './gravityField';
import {clearingSupport} from '../scenery/planet/lanternClearing';

export {homeWorld,walkWorlds,type World};
const facets=new Map(allMoons.filter(w=>w.id!=='tide').map(w=>{
  const [cols,rows]=moonSegments(w);
  return [w,facetSampler(cols,rows,(x,y,z)=>moonRadius(w,x,y,z))] as const;
}));
export function shellRadius(w:World,x:number,y:number,z:number){
  if(w.id==='home')return homeShellRadius(x,y,z);
  // The grotto uses its own cut floor mesh, not SphereGeometry meridian cells.
  if(w.id==='tide')return moonRadius(w,x,y,z);
  // A chord can bridge a depression in the continuous relief. Use the safe
  // outer one so neither the visible rock nor its walking surface is crossed.
  const face=facets.get(w)!(x,y,z);
  return Math.max(face,moonRadius(w,x,y,z),w.id==='lantern'?clearingSupport(x,y,z):0);
}
export function altitude(w:World,p:Vector3){
  const x=p.x-w.centre.x,y=p.y-w.centre.y,z=p.z-w.centre.z,r=Math.hypot(x,y,z);
  return r>1e-10?r-shellRadius(w,x/r,y/r,z/r):-w.radius;
}

/** Read the CURRENT tracked offset at both ends of the virtual move: a
 * physical lean is never a virtual displacement to undo. A spine of
 * overlapping round sections covers the body, including between foot & head.
 * In addition to the tracked column the motor sole keeps its own support. */
export function createShellSweep(){
  const point=new Vector3(),rel=new Vector3(),probe=new Vector3(),radial=new Vector3();
  const hit={world:homeWorld as World,t:1,point:new Vector3(),up:new Vector3(),part:'foot' as 'foot'|'body'|'head',tracked:false};
  let found=false;
  function section(start:Vector3,delta:Vector3,radius:number,part:typeof hit.part){
    const d2=delta.lengthSq(),distance=Math.sqrt(d2);if(distance<1e-12)return;
    for(const w of walkWorlds){
      rel.subVectors(start,w.centre);
      const outer=w.radius+(w.id==='home'||w.id==='tide'?4:1.4)+radius,projection=rel.dot(delta)/d2;
      const disc=projection*projection-(rel.lengthSq()-outer*outer)/d2;if(disc<0)continue;
      const half=Math.sqrt(disc),a=Math.max(0,-projection-half),b=Math.min(hit.t,-projection+half);if(b<=a)continue;
      const gap=(t:number)=>altitude(w,probe.copy(start).addScaledVector(delta,t))-radius;
      const ga=gap(a);
      // When tracking or a walking sole starts in a slope, only travel which
      // goes further in is obstructed. Never separate the real headset.
      const threshold=ga>.0003?0:Math.min(0,ga)-.00015;
      // |d (r-relief)/d metres| < 12 for these bounded shell profiles.
      // Reject a whole interval by this bound, not just its endpoints. A
      // sub-mm grazing interval terminates conservatively on its outside.
      function first(lo:number,hi:number,left:number,right:number):number{
        if(left<=threshold)return lo;
        const span=(hi-lo)*distance;
        if(Math.min(left,right)-6*span>threshold)return Infinity;
        if(span<.00002)return lo;
        const mid=(lo+hi)/2,m=gap(mid),t=first(lo,mid,left,m);
        return Number.isFinite(t)?t:first(mid,hi,m,right);
      }
      const t=first(a,b,ga,gap(b));if(!(t<hit.t))continue;
      probe.copy(start).addScaledVector(delta,t);radial.subVectors(probe,w.centre).normalize();
      found=true;hit.world=w;hit.t=t;hit.up.copy(radial);hit.point.copy(w.centre).addScaledVector(radial,shellRadius(w,radial.x,radial.y,radial.z));hit.part=part;hit.tracked=start===point;
    }
  }
  return function sweep(foot:Vector3,delta:Vector3,up:Vector3,eyeOffset:Vector3,trackedHeight=eyeOffset.dot(up)){
    found=false;hit.t=1;section(foot,delta,0,'foot');
    // Eye offset is the unmodified, calibrated tracking vector in world axes.
    const h=Math.min(3,Math.max(.18,trackedHeight)),n=Math.max(1,Math.ceil(h/.18));
    point.copy(foot).add(eyeOffset).addScaledVector(up,-trackedHeight);
    if(point.distanceToSquared(foot)>1e-8)section(point,delta,0,'foot');
    point.addScaledVector(up,.15);
    for(let i=0;i<=n;i++){
      const head=i===n;section(point,delta,head?.115:.15,head?'head':'body');
      point.addScaledVector(up,(h-.15)/n);
    }
    if(trackedHeight!==h)section(point.copy(foot).add(eyeOffset),delta,.115,'head');
    return found?hit:null;
  };
}
