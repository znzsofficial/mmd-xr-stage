import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {caveCrest,caveMouth,caveSoffit,onTideDeck,tideCentre,tideDatum,tideDeck,tideFloor,tideRadius,tideRelief,tideSolid} from './tideLayout';
import {tideCaveRock,tideTerrain} from './tideStone';

const world=(x:number,y:number,z:number)=>new Vector3(tideCentre.x+x,tideDatum+y,tideCentre.z+z);
const radial=(x:number,y:number,z:number)=>new Vector3(x,tideRadius+y,z);
it('puts the radial foot on the actual shell facets, including the five shell noses, pool and dry actor plate',()=>{
  const {shore,globe}=tideTerrain(),mat=new MeshBasicMaterial(),shell=new Mesh(shore,mat),ray=new Raycaster(),down=new Vector3(0,-1,0);
  let error=0;try{
    for(const z of [-1.63,-1.02,-.46,0,.58,1.45])for(let x=.31;x<6.61;x+=.237){
      const top=tideFloor(x,z),p=radial(x,top,z),r=p.length();p.divideScalar(r);
      error=Math.max(error,Math.abs(tideRadius+tideRelief(p.x,p.y,p.z)-r));
      ray.set(new Vector3(x,2,z),down);const hit=ray.intersectObject(shell)[0];expect(hit).toBeDefined();
      error=Math.max(error,Math.abs(hit.point.y-top));
    }
    expect(error).toBeLessThan(.00005);
    for(let k=0;k<40;k++){const a=k*Math.PI/20,c=Math.cos(a),s=Math.sin(a);
      expect(tideFloor(.92*c,.92*s)).toBeCloseTo(0,7);
      expect(onTideDeck(tideDeck.x+1.075*c,tideDeck.z+1.075*s)).toBe(true);
      expect(tideFloor(5.50+1.075*c,1.075*s)).toBeCloseTo(.10,7);
    }
  }finally{mat.dispose();shore.dispose();globe.dispose();}
});

it('keeps a 2.1 m corridor over the shelves and the dry bank, and opens the visible rock towards Reedwater',()=>{
  const g=tideCaveRock(),mat=new MeshBasicMaterial(),mesh=new Mesh(g,mat),ray=new Raycaster();
  const floor=(x:number,z:number)=>tideFloor(x,z);
  try{for(const z of [0,1.45])for(let x=1;x<=6.45;x+=.17){
    const y=floor(x,z);expect(tideSolid(world(x,y,z),.22,2.1),`headroom at ${x},${z}`).toBe(false);
    if(z!==0)expect(y).toBeGreaterThanOrEqual(.0999);
    if(x>caveMouth(z)+.12){ray.set(new Vector3(x,y+.02,z),new Vector3(0,1,0));
      const ceiling=ray.intersectObject(mesh)[0];expect(ceiling?.point.y).toBeGreaterThan(y+2.1);
      expect(ceiling?.point.y).toBeCloseTo(caveSoffit(x,z),1);
    }
  }
  for(const [x,z] of [[4.8,0],[5.50,0],[5.90,-.62]]){
    const eye=new Vector3(x,1.72,z),towards=new Vector3(-39.2,14.9,2).sub(eye).normalize();
    ray.set(eye,towards);expect(ray.intersectObject(mesh)).toHaveLength(0);
    for(let d=0;d<9;d+=.04){const p=eye.clone().addScaledVector(towards,d);expect(tideSolid(world(p.x,p.y,p.z),0,0)).toBe(false);}
  }
  const x=3.12,z=0,low=caveSoffit(x,z),top=caveCrest(x,z);expect(top-low).toBeGreaterThan(.30);
  expect(tideSolid(world(x,(low+top)/2,z),0,0)).toBe(true);expect(tideSolid(world(x,top+.10,z),0,0)).toBe(false);
  // At the same eye height the two chalk shoulders stand in front of the
  // actor's recessed backdrop. The locator must see each rendered shelf.
  for(const y of [.55,1.28,1.93]){const hits:number[]=[];
    for(const z of [-1.61,0,1.61]){ray.set(new Vector3(5.5,y,z),new Vector3(1,0,0));
      const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();hits.push(hit.point.x);
      expect(tideSolid(world(hit.point.x-.085,y,z),0,0)).toBe(false);
      expect(tideSolid(world(hit.point.x+.085,y,z),0,0)).toBe(true);
    }
    expect(hits[1]-Math.max(hits[0],hits[2])).toBeGreaterThan(.49);
  }
  }finally{g.dispose();mat.dispose();}
});
