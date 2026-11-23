import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {caveBackThickness,caveCrest,caveLip,caveMouth,caveRear,caveSoffit,onTideDeck,seaWindow,tideCentre,tideDatum,tideDeck,tideFloor,tideRadius,tideRelief,tideSolid,windowLevel} from './tideLayout';
import {reedCentre} from './reedBiosphere';
import {ebbLevel} from './tideClock';
import {tideCaveRock,tideTerrain} from './tideStone';

const world=(x:number,y:number,z:number)=>new Vector3(tideCentre.x+x,tideDatum+y,tideCentre.z+z);
const radial=(x:number,y:number,z:number)=>new Vector3(x,tideRadius+y,z);
it('puts the radial foot on the actual shell facets, including the five shell noses, pool and dry actor plate',()=>{
  const {shore,globe}=tideTerrain(),mat=new MeshBasicMaterial(),shell=new Mesh(shore,mat),ray=new Raycaster(),down=new Vector3(0,-1,0);
  let error=0;try{
    // No buried second radial root on the steep sides of the extended pool:
    // every rendered facet must face outward from the actual lunar centre.
    const p=shore.attributes.position,ix=shore.index!,a=new Vector3(),ab=new Vector3(),ac=new Vector3(),pole=new Vector3(0,-tideRadius,0);
    let least=Infinity;
    for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));ab.fromBufferAttribute(p,ix.getX(i+1)).sub(a);ac.fromBufferAttribute(p,ix.getX(i+2)).sub(a);
      least=Math.min(least,ab.cross(ac).dot(a.sub(pole)));}
    expect(least).toBeGreaterThan(0);
    for(const z of [-1.63,-1.02,-.46,0,.58,1.45])for(let x=.31;x<6.61;x+=.237){
      const top=tideFloor(x,z),p=radial(x,top,z),r=p.length();p.divideScalar(r);
      expect(tideRadius+tideRelief(p.x,p.y,p.z),`radial sample ${x}, ${z}, floor ${top}`).toBeCloseTo(r,4);
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
  for(const [x,z,h] of [[5.64,-1.26,1.15],[4.8,0,1.62],[5.50,0,1.62],[5.90,-.62,1.62]]){
    const eye=new Vector3(x,tideFloor(x,z)+h,z),towards=reedCentre.clone().sub(world(eye.x,eye.y,eye.z)).normalize();
    ray.set(eye,towards);expect(ray.intersectObject(mesh)).toHaveLength(0);
    for(let d=0;d<9;d+=.04){const p=eye.clone().addScaledVector(towards,d);expect(tideSolid(world(p.x,p.y,p.z),0,0)).toBe(false);}
  }
  for(const eye of [new Vector3(0,1.65,0),new Vector3(5.5,1.72,0)]){
    const pool=eye.x===0?new Vector3(4.37,ebbLevel,-1.46):new Vector3(3.1,ebbLevel,-1.18);
    expect(tideFloor(pool.x,pool.z)).toBeLessThan(ebbLevel-.10);
    const to=pool.clone().sub(eye);ray.far=to.length();ray.set(eye,to.normalize());expect(ray.intersectObject(mesh)).toHaveLength(0);
    for(let d=0;d<ray.far;d+=.04){const p=eye.clone().addScaledVector(to,d);expect(p.y).toBeGreaterThan(tideFloor(p.x,p.z));}
  }ray.far=Infinity;
  const z=0,x=caveMouth(z)+.44,low=caveSoffit(x,z),top=caveCrest(x,z);expect(top-low).toBeGreaterThan(.30);
  expect(tideSolid(world(x,(low+top)/2,z),0,0)).toBe(true);expect(tideSolid(world(x,top+.10,z),0,0)).toBe(false);
  // The aperture is offset. An actor in the centre still gets a real rock
  // backdrop, recessed from the massive headland on the high bank.
  for(const y of [.55,1.28,1.93]){const hits:number[]=[];
    for(const z of [0,1.61]){ray.set(new Vector3(5.5,y,z),new Vector3(1,0,0));
      const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();hits.push(hit.point.x);
      expect(tideSolid(world(hit.point.x-.085,y,z),0,0)).toBe(false);
      expect(tideSolid(world(hit.point.x+.085,y,z),0,0)).toBe(true);
    }
    expect(hits[0]-hits[1]).toBeGreaterThan(.49);
  }
  }finally{g.dispose();mat.dispose();}
});

it('cuts the cantilever, recessed bank and lateral sea window into both LODs and the solid',()=>{
  const ray=new Raycaster(),mat=new MeshBasicMaterial(),dir=new Vector3(1,0,0);
  try{for(const far of [false,true]){
    const geo=tideCaveRock(far),mesh=new Mesh(geo,mat);
    try{
      const cuts=[];
      for(const z of [1.58,-.90,-1.95]){
        const mouth=caveMouth(z),inner=caveSoffit(mouth,z),outer=caveCrest(caveLip(z,1),z),y=.5*(inner+outer);
        ray.set(new Vector3(-1.5,y,z),dir);const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();
        const x=hit.point.x;cuts.push({x,thickness:outer-inner});
        expect(x,`lip at z=${z}, far=${far}`).toBeCloseTo(caveLip(z,.5),1);
        expect(tideSolid(world(x-.07,y,z),0,0)).toBe(false);
        expect(tideSolid(world(x+.07,y,z),0,0)).toBe(true);
      }
      expect(cuts[1].x-cuts[0].x).toBeGreaterThan(1.8);
      expect(cuts[2].x-cuts[1].x).toBeGreaterThan(.65);
      expect(cuts[0].thickness).toBeGreaterThan(2.1*cuts[1].thickness);
      // The shoulder stays broad well outside the old arch. On the pool
      // side two broken tabular outcrops step down towards the sea. These
      // exposed caps must be the actual solid from above and below.
      const caps:number[]=[];
      for(const [x,z] of [[3.9,3.07],[5.28,-3.80],[2.14,-3.77]]){
        ray.set(new Vector3(x,6,z),new Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();
        const h=hit.point.y;caps.push(h);expect(tideSolid(world(x,h+.055,z),0,0)).toBe(false);
        expect(tideSolid(world(x,h-.055,z),0,0)).toBe(true);
      }
      expect(caps[0]).toBeGreaterThan(3.70);expect(caps[1]-caps[2]).toBeGreaterThan(.60);
      // Two sightlines almost 1.5 m apart clear the horizontal fracture,
      // while a point only 45 cm above each meets the overlying bed.
      for(const z of [seaWindow.z-.77,seaWindow.z+.68]){
        ray.set(new Vector3(0,windowLevel(z),z),dir);expect(ray.intersectObject(mesh)).toHaveLength(0);
        ray.ray.origin.y+=.45;expect(ray.intersectObject(mesh).length,`lintel at ${z}, far=${far}`).toBeGreaterThan(0);
      }
      for(const z of [seaWindow.z-.34,seaWindow.z,seaWindow.z+.39]){
        const y=windowLevel(z),outside=caveRear(z)+caveBackThickness;
        ray.set(new Vector3(5.6,y,z),dir);expect(ray.intersectObject(mesh)).toHaveLength(0);
        for(let x=5.6;x<outside+.3;x+=.031)expect(tideSolid(world(x,y,z),0,.12)).toBe(false);
        // Look up and down from *inside* the opening. Its returns are real
        // rock on both sides of what would otherwise be a hole in a plane.
        for(const sign of [-1,1]){
          ray.set(new Vector3(outside-.14,y,z),new Vector3(0,sign,0));const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();
          const p=hit.point;expect(tideSolid(world(p.x,p.y-sign*.08,p.z),0,0)).toBe(false);
          expect(tideSolid(world(p.x,p.y+sign*.08,p.z),0,0)).toBe(true);
        }
      }
      const shore=new Vector3(0,1.65,0),exit=new Vector3(caveRear(seaWindow.z),windowLevel(seaWindow.z),seaWindow.z);
      ray.set(shore,exit.sub(shore).normalize());expect(ray.intersectObject(mesh)).toHaveLength(0);
    }finally{geo.dispose();}
  }}finally{mat.dispose();}
});
