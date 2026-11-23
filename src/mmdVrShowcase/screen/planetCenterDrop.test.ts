import {Mesh,MeshBasicMaterial,PlaneGeometry,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {lanternShots} from '../scenery/planet/lanternShots';
import {clearingDeck,lanternCentre} from '../scenery/planet/lanternClearing';
import {planetCenterDrop} from './planetCenterDrop';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../scenery/placementAreas';
import {tourShots} from '../scenery/roomViews';
import {tideCentre,tideDeck,tideDatum,tideFloor,tideWaterFootprint} from '../scenery/planet/tideLayout';
import {floodLevel,ebbLevel} from '../scenery/planet/tideClock';
import {reedCentre,reedRadius} from '../scenery/planet/reedBiosphere';

it('places from the clearing portrait on its flat deck, retains the mother stage at entry and rejects the hidden nearest deck',()=>{
  const {x,y,z}=clearingDeck;
  const eye=new Vector3().fromArray(lanternShots.find(s=>s.key==='lanternClearingView')!.eye);
  expect(planetCenterDrop(eye)).toEqual({x,y,z});expect(planetCenterDrop({x:0,y:2.18,z:3.45})).toEqual({x:0,y:0,z:0});
  expect(planetCenterDrop(lanternCentre.clone().add(new Vector3(-8,-1,1)))).toBeNull();
});

it('hits the inner dry stage through the actual pick planes, while the roof, back wall and unapproved water floor reject placements',()=>{
  const room='glassPlanet',shot=tourShots(room).find(v=>v.key==='tideStage')!,eye=new Vector3().fromArray(shot.eye);
  const {x,y,z}=tideDeck,mat=new MeshBasicMaterial(),planes=roomPickDecks(room).map(d=>{
    const g=new Mesh(new PlaneGeometry(d.w,d.d),mat);g.rotateX(-Math.PI/2);g.position.set(d.x,d.y+.012,d.z);g.updateMatrixWorld();g.userData.y=d.y;return g;
  });
  try{for(const [dx,dz] of [[0,0],[.50,-.45],[-.40,.48]]){
    const to=new Vector3(x+dx,y+.012,z+dz),ray=new Raycaster(eye,to.clone().sub(eye).normalize());
    const hit=ray.intersectObjects(planes)[0];expect(hit.object.userData.y).toBe(y);
    expect(hit.point.distanceTo(to)).toBeLessThan(1e-6);expect(visiblePick(room,eye,to.x,y,to.z)).toBe(true);
    expect(resolvePlacementHeight(room,to.x,to.z,y)).toBe(y);
  }}finally{planes.forEach(p=>p.geometry.dispose());mat.dispose();}
  expect(planetCenterDrop(eye)).toEqual({x,y,z});
  expect(planetCenterDrop({x,y:y+8,z})).toBeNull();expect(planetCenterDrop({x:x+4,y:y+1.65,z})).toBeNull();
  expect(resolvePlacementHeight(room,x,z,0)).toBeNull();expect(resolvePlacementHeight(room,tideCentre.x+2.8,z,y)).toBeNull();
});

it('frames the neighbouring disc and its reflection; the high-tide mirror ray actually reaches a wet part of the channel',()=>{
  const shot=tourShots('glassPlanet').find(v=>v.key==='tideMoonrise')!;
  const eye=new Vector3().fromArray(shot.eye),aim=new Vector3().fromArray(shot.aim).sub(eye),pitch=Math.atan2(aim.y,Math.hypot(aim.x,aim.z));
  const centre=reedCentre.clone();
  function inFrame(c:Vector3){const d=c.clone().sub(eye),angle=Math.atan2(d.y,Math.hypot(d.x,d.z));
    expect(Math.abs(angle-pitch)+Math.asin(reedRadius/d.length())).toBeLessThan(shot.fov!*Math.PI/360);}
  inFrame(centre);
  for(const water of [floodLevel,ebbLevel]){
    const surface=tideDatum+water;centre.y=2*surface-reedCentre.y;inFrame(centre);
    // At ebb only a narrow lower portion of the disc reaches the remaining pool.
    if(water===ebbLevel)centre.y-=reedRadius*.90;
    const p=eye.clone().lerp(centre,(surface-eye.y)/(centre.y-eye.y)),lx=p.x-tideCentre.x,lz=p.z-tideCentre.z;
    expect(tideWaterFootprint(lx,lz)).toBe(true);expect(tideFloor(lx,lz)).toBeLessThan(water-.01);
  }
});
