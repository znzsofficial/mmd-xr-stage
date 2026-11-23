import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {safeClothScale,fitClothStrain} from './clothStrain';
const point=(x:number,y:number,dx=0,dy=0)=>({p:new Vector3(x,y,0),d:new Vector3(dx,dy,0),movable:true});
it('does not accept a flip that crosses zero twice and ends front-facing, or collapse a regular face',()=>{
  const a=point(0,0),b=point(1,0,-3),c=point(0,1,0,-1.8),limit=safeClothScale(),s=limit(a,b,c);
  expect((1-3)*(1-1.8)).toBeGreaterThan(0);expect(s).toBeGreaterThan(.10);expect(s).toBeLessThan(1/3);
  for(let j=0;j<=32;j++){const t=j*s/32;expect((1-3*t)*(1-1.8*t)).toBeGreaterThanOrEqual(.28);}
  c.d.set(0,-.95,0);b.d.set(0,0,0);expect(limit(a,b,c)).toBeLessThan(.77);
  c.d.set(7,-3,2);a.d.copy(c.d);b.d.copy(c.d);expect(limit(a,b,c)).toBe(1);
});
it('includes a thin fixed boundary, but an unrelated island keeps its full displacement',()=>{
  const points=[point(0,0),point(1,0),point(.2,.0001,0,-.8),point(2,0,.1,.2),point(3,0,.1,.2),point(3,1,.1,.2)];
  points[0].movable=points[1].movable=false;
  const read:number[]=[],bound=fitClothStrain(points,[{a:0,b:1,c:2},{a:3,b:4,c:5}],i=>read.push(i));bound();
  expect(read.sort()).toEqual([0,1]);expect(points[2].p.y+points[2].d.y).toBeGreaterThan(0);
  for(const p of points.slice(3))expect(p.d.toArray()).toEqual([.1,.2,0]);
});
