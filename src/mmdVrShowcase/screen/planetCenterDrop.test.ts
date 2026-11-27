import {Mesh,MeshBasicMaterial,PlaneGeometry,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {lanternShots} from '../scenery/planet/lanternShots';
import {clearingDeck,lanternCentre} from '../scenery/planet/lanternClearing';
import {planetCenterDrop} from './planetCenterDrop';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../scenery/placementAreas';
import {tourShots} from '../scenery/roomViews';

it('places from the clearing portrait on its flat deck, retains the mother stage at entry and rejects the hidden nearest deck',()=>{
  const {x,y,z}=clearingDeck;
  const eye=new Vector3().fromArray(lanternShots.find(s=>s.key==='lanternClearingView')!.eye);
  expect(planetCenterDrop(eye)).toEqual({x,y,z});expect(planetCenterDrop({x:0,y:2.18,z:3.45})).toEqual({x:0,y:0,z:0});
  expect(planetCenterDrop(lanternCentre.clone().add(new Vector3(-8,-1,1)))).toBeNull();
});

it('hits the Lantern clearing through the actual pick planes; the retired deck has no shot, plane or valid placement',()=>{
  const room='glassPlanet',shots=tourShots(room),shot=shots.find(v=>v.key==='lanternClearingView')!,eye=new Vector3().fromArray(shot.eye);
  const {x,y,z}=clearingDeck,mat=new MeshBasicMaterial(),planes=roomPickDecks(room).map(d=>{
    const g=new Mesh(new PlaneGeometry(d.w,d.d),mat);g.rotateX(-Math.PI/2);g.position.set(d.x,d.y+.012,d.z);g.updateMatrixWorld();g.userData.y=d.y;return g;
  });
  try{for(const [dx,dz] of [[0,0],[.50,-.45],[-.40,.48]]){
    const to=new Vector3(x+dx,y+.012,z+dz),ray=new Raycaster(eye,to.clone().sub(eye).normalize());
    const hit=ray.intersectObjects(planes)[0];expect(hit.object.userData.y).toBe(y);
    expect(hit.point.distanceTo(to)).toBeLessThan(1e-6);expect(visiblePick(room,eye,to.x,y,to.z)).toBe(true);
    expect(resolvePlacementHeight(room,to.x,to.z,y)).toBe(y);
  }}finally{planes.forEach(p=>p.geometry.dispose());mat.dispose();}
  expect(planes).toHaveLength(2);expect(shots.some(s=>s.key.startsWith('tide'))).toBe(false);
  expect(resolvePlacementHeight(room,28.5,20,-7.9)).toBeNull();expect(visiblePick(room,{x:28.5,y:-6,z:20},28.5,-7.9,20)).toBe(false);
});
