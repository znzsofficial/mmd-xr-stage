import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {crustRadius,makeCrust,stationBlocks,stations} from './opalTerrain';
import {planetSight} from './planetSightline';

it('the rendered / Rapier shell and the independent cold-start support agree across both hemispheres and the antimeridian',()=>{
  const g=makeCrust(),m=new MeshBasicMaterial(),surface=new Mesh(g,m),ray=new Raycaster(),n=new Vector3();
  let error=0,min=Infinity,max=0;
  try{for(let i=0;i<240;i++){
    const y=1-(i+.5)/120,s=Math.sqrt(1-y*y);n.set(s*Math.sin(i*2.4),y,s*Math.cos(i*2.4));
    const r=crustRadius(n.x,n.y,n.z);min=Math.min(min,r);max=Math.max(max,r);
    ray.ray.origin.copy(n).multiplyScalar(18);ray.ray.direction.copy(n).negate();
    const hit=ray.intersectObject(surface)[0];expect(hit).toBeDefined();error=Math.max(error,Math.abs(hit.point.length()-r));
  }expect(error).toBeLessThan(.035);expect(max-min).toBeGreaterThan(2.3);}finally{g.dispose();m.dispose();}
});
it('rejects a drop through the landing observatory, but accepts a nearby unobstructed deck ray',()=>{
  const dome=stations.find(s=>s.name==='landing-observatory')!;
  const middle=dome.base.clone().addScaledVector(dome.up,1.30);
  expect(stationBlocks(middle,0,.01)).toBe(true);
  expect(planetSight(middle.clone().multiplyScalar(1.36),0,0,0)).toBe(false);
  expect(planetSight({x:.2,y:1.7,z:1.9},0,0,0)).toBe(true);
});
