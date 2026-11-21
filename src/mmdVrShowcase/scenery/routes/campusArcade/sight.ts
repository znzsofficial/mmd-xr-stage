import {Euler,Matrix4} from 'three';
import type {Part} from '../../SceneryBatch';
import type {RoutePoint} from '../types';

// Match SceneryBatch's default Three Euler order. Cull on the exact enclosing
// AABB, then clip the ray in the member's local axes: open rungs stay open.
export function orientedMember(part:Part,origin:{x:number;z:number}){
  const e=new Matrix4().makeRotationFromEuler(new Euler(part.rx,part.ry,part.rz,'XYZ')).elements;
  const [hx,hy,hz]=part.s.map(v=>v/2),[x,y,z]=part.p,cx=x+origin.x,cz=z+origin.z;
  const extent=(r:number)=>Math.abs(e[r])*hx+Math.abs(e[4+r])*hy+Math.abs(e[8+r])*hz;
  const ex=extent(0),ey=extent(1),ez=extent(2);
  return (a:RoutePoint,b:RoutePoint)=>{
    if(Math.min(a.x,b.x)>cx+ex||Math.max(a.x,b.x)<cx-ex||Math.min(a.y,b.y)>y+ey||Math.max(a.y,b.y)<y-ey||Math.min(a.z,b.z)>cz+ez||Math.max(a.z,b.z)<cz-ez)return false;
    const ax=a.x-cx,ay=a.y-y,az=a.z-cz,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;let lo=0,hi=1;
    for(const [k,h] of [[0,hx],[4,hy],[8,hz]]){
      const p=ax*e[k]+ay*e[k+1]+az*e[k+2],d=dx*e[k]+dy*e[k+1]+dz*e[k+2];
      if(Math.abs(d)<1e-9){if(Math.abs(p)>h)return false;continue;}
      const m=(-h-p)/d,n=(h-p)/d;lo=Math.max(lo,Math.min(m,n));hi=Math.min(hi,Math.max(m,n));if(hi<lo)return false;
    }return true;
  };
}
