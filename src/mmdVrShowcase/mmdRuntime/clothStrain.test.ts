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

it('keeps the last admissible grid step for shortening, re-expanding, twisted and needle faces',()=>{
  const limit=safeClothScale(),at=[new Vector3(),new Vector3(),new Vector3()],e=new Vector3(),f=new Vector3(),n=new Vector3();
  const cases=[
    [1,0,1, 0,0,0,-1.44,0,0], // linear area floor exactly at 1/2
    [1,0,1, -3,0,0,-1.8,0,0], // two interior zeros, positive final area
    [1,0,1, .7,-2,4,3,0,0],
    [1,.31,.003, -.1,.07,.34,-.12,.5,-.4], // thin material with out-of-plane motion
    [1.3,.2,.7, -5,.6,-.1,1.5,2,5],
  ];
  for(const [bx,cx,cy,dx,ex,dy,ey,dz,ez] of cases){
    const pts=[point(0,0),point(bx,0,dx,ex),point(cx,cy,dy,ey)];pts[1].d.z=dz;pts[2].d.z=ez;
    // Independent direct geometry sweep in the deformed triangle, not the
    // production polynomial/root calculation. Keep the first failed step.
    const norm=e.subVectors(pts[1].p,pts[0].p).cross(f.subVectors(pts[2].p,pts[0].p)).clone(),sq=norm.lengthSq();
    const lengths=pts.map((p,i)=>p.p.distanceToSquared(pts[(i+1)%3].p)),long=Math.max(...lengths),floor=sq>.0025*long*long?.28:.045;
    let grid=0;for(let k=1;k<=8192;k++){
      pts.forEach((p,i)=>at[i].copy(p.p).addScaledVector(p.d,k/8192));n.crossVectors(e.subVectors(at[1],at[0]),f.subVectors(at[2],at[0]));
      if(n.dot(norm)/sq<floor||at.some((p,i)=>p.distanceToSquared(at[(i+1)%3])>3.24*lengths[i]+.004*long))break;
      grid=k;
    }
    expect(limit(pts[0],pts[1],pts[2])).toBe(grid===8192?1:grid/8192*.998);
  }
});
