import {Mesh,MeshBasicMaterial,PlaneGeometry,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../placementAreas';
import {shellRadius} from '../../movement/orbitalSurfaces';
import {clearingDeck as d,clearingRelief,lanternCentre,lanternRadius} from './lanternClearing';
import {moons} from './windAtlas';

it('keeps the full 06 return collar clear of the portrait-stage approach ramp',()=>{
  for(const distance of [0,.5,.72,.77])for(let k=0;k<16;k++){
    const a=k*Math.PI/8,x=distance*Math.cos(a)/lanternRadius,z=distance*Math.sin(a)/lanternRadius;
    expect(clearingRelief(x,Math.sqrt(1-x*x-z*z),z,0)).toBeCloseTo(0,12);
  }
});

it('places an upright actor at the actual lunar deck height through its pick plane, with a visible path from the north collar',()=>{
  const moon=moons.find(m=>m.id==='lantern')!, deck=roomPickDecks('glassPlanet').find(v=>v.y===d.y)!;
  const mat=new MeshBasicMaterial(),g=new PlaneGeometry(deck.w,deck.d),surface=new Mesh(g,mat);
  surface.rotateX(-Math.PI/2);surface.position.set(deck.x,deck.y+.012,deck.z);surface.updateMatrixWorld();
  const eye=lanternCentre.clone().add(new Vector3(0,moon.radius+1.6,0));
  try{for(const [x,z] of [[d.x,d.z],[d.x-.77,d.z+.45],[d.x+.8,d.z-.4]]){
    const towards=new Vector3(x,d.y+.012,z),hit=new Raycaster(eye,towards.clone().sub(eye).normalize()).intersectObject(surface)[0];
    expect(hit?.point.distanceTo(towards)).toBeLessThan(1e-6);
    expect(resolvePlacementHeight('glassPlanet',hit.point.x,hit.point.z,deck.y)).toBe(deck.y);
    expect(visiblePick('glassPlanet',eye,x,d.y,z)).toBe(true);
    const n=new Vector3(x,d.y,z).sub(lanternCentre).normalize();expect(shellRadius(moon,n.x,n.y,n.z)*n.y+lanternCentre.y).toBeCloseTo(d.y,5);
  }}finally{g.dispose();mat.dispose();}
  expect(resolvePlacementHeight('glassPlanet',d.x,d.z,0)).toBeNull();
  expect(resolvePlacementHeight('glassPlanet',0,0,d.y)).toBeNull();
  expect(resolvePlacementHeight('glassPlanet',d.x+1.2,d.z+1.2,d.y)).toBeNull();
  expect(visiblePick('glassPlanet',lanternCentre,d.x,d.y,d.z)).toBe(false);
});
