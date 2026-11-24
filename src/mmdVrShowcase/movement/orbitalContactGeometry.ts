import {Vector3} from 'three';
import {altitude,type World} from './orbitalSurfaces';

// The sweep tests altitude(probe) - radius. Its gradient at the rounded
// section, not the centre-to-ground direction, is the separating normal.
export function shellContactNormal(w:World,point:Vector3,up:Vector3,radius:number,out:Vector3,p:Vector3){
  const e=.0002,x=point.x+radius*up.x,y=point.y+radius*up.y,z=point.z+radius*up.z;
  return out.set(altitude(w,p.set(x+e,y,z))-altitude(w,p.set(x-e,y,z)),
    altitude(w,p.set(x,y+e,z))-altitude(w,p.set(x,y-e,z)),
    altitude(w,p.set(x,y,z+e))-altitude(w,p.set(x,y,z-e))).normalize();
}

// Only the planet currently being skimmed needs this release test. A gap
// between sweeps is not separation: an adjacent section can be touching.
export function clearOfSkim(w:World,foot:Vector3,up:Vector3,eye:Vector3,height:number,p:Vector3){
  const gap=.002,h=Math.max(.18,Math.min(3,height)),n=Math.ceil(h/.18);
  if(altitude(w,foot)<=gap)return false;
  p.copy(foot).add(eye).addScaledVector(up,-height);
  if(altitude(w,p)<=gap)return false;
  p.addScaledVector(up,.15);
  for(let i=0;i<=n;i++){
    if(altitude(w,p)<=(i===n?.115:.15)+gap)return false;
    p.addScaledVector(up,(h-.15)/n);
  }
  return height===h||altitude(w,p.copy(foot).add(eye))>.115+gap;
}
