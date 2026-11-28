import {expect,it} from 'vitest';
import {Box3,Mesh,MeshBasicMaterial,Ray,Raycaster,Vector3} from 'three';
import {resolveStageLighting} from '../stage/lighting';
import {roomSets} from './roomSets';
import {platformGeometry} from './terminus/platformFinish';
import {SHORE_SUN} from './shoreDaylight';
import {CLERESTORY,HIGH_PANES} from './ClassroomLayout';
import {classroomProps} from './ClassroomProps';
import {deckFinish} from './lidoFinish';
import {POOL} from './LidoLayout';

it('resolves the two natural keys without changing the studio or a chosen coloured key',()=>{
  const studio=resolveStageLighting('stage',{});
  for(const room of [roomSets.classroom,roomSets.seasideTerminus]){
    const natural=resolveStageLighting('stage',room);
    expect(natural.sun).toBeGreaterThan(studio.sun);
    expect(natural.sunColor).not.toBe(studio.sunColor);
    for(const preset of ['daylight','warm','rim'] as const){
      const chosen=resolveStageLighting(preset,{});
      expect(resolveStageLighting(preset,room)).toMatchObject({sun:chosen.sun,sunColor:chosen.sunColor,sunPos:natural.sunPos});
    }
  }
  expect(resolveStageLighting('stage',roomSets.floor)).toEqual(studio);
});

it('shades the sheltered platform tiles while leaving the open platform and far quay in sun',()=>{
  const deck=new Mesh(platformGeometry(false),new MeshBasicMaterial()),realShadows=platformGeometry(true);
  const colour=deck.geometry.getAttribute('color');
  function sample(x:number,z:number){
    const [hit]=new Raycaster(new Vector3(x,1,z),new Vector3(0,-1,0)).intersectObject(deck);
    const face=hit.face!,weights=hit.barycoord!;
    return new Vector3().fromBufferAttribute(colour,face.a).multiplyScalar(weights.x)
      .addScaledVector(new Vector3().fromBufferAttribute(colour,face.b),weights.y)
      .addScaledVector(new Vector3().fromBufferAttribute(colour,face.c),weights.z);
  }
  try{
    const shade=sample(-2.1,3.2),sun=sample(1.5,-4);
    expect(shade.x).toBeLessThan(shade.z);
    expect(shade.z).toBeLessThan(sun.z);
    expect(sun.toArray()).toEqual([1,1,1]);
    expect(sample(8,-12).distanceTo(sun)).toBeLessThan(1e-6);
    expect(realShadows.hasAttribute('color')).toBe(false);
  }finally{deck.geometry.dispose();deck.material.dispose();realShadows.dispose();}
});

it('keeps the same sun across the four doors and admits the classroom floor ray through a real high window',()=>{
  const direction=new Vector3(...SHORE_SUN).normalize();
  for(const id of ['clinic','classroom','pool','arcadeHall'] as const){
    expect(roomSets[id].sky).toBe('harbour');
    const light=resolveStageLighting('stage',roomSets[id]);
    expect(new Vector3(...light.sunPos).normalize().distanceTo(direction)).toBeLessThan(1e-8);
    if(id!=='pool')expect(light.sun).toBeLessThan(roomSets.pool.stageLight!.sun);
  }
  const shell=classroomProps().shell.map(part=>new Box3().setFromCenterAndSize(new Vector3(...part.p),new Vector3(...part.s)));
  function floorRay(windowX:number){
    const h=(CLERESTORY.sill+CLERESTORY.head)/2;
    const origin=new Vector3(windowX,h,CLERESTORY.z).addScaledVector(direction,-h/direction.y);
    return shell.some(wall=>new Ray(origin,direction).intersectsBox(wall));
  }
  const pane=HIGH_PANES[3];
  expect(floorRay((pane.left+pane.right)/2)).toBe(false);
  expect(floorRay(pane.left-CLERESTORY.pier/2)).toBe(true);
});

it('bakes the parasol away from the sun only with shadows off and keeps the splash zone glossier than dry stone',()=>{
  const low=deckFinish(false),high=deckFinish(true),{deck}=POOL;
  const sample=(x:number,z:number)=>{
    const {width,height,data}=low.image,i=Math.floor((.5+(x-deck.x)/deck.w)*width),j=Math.floor((.5-(z-deck.z)/deck.d)*height);
    const offset=(j*width+i)*4;
    if(!data||!high.image.data)throw Error('Missing deck finish pixels');
    return {baked:data[offset],live:high.image.data[offset],rough:data[offset+1]};
  };
  try{
    const p=POOL.parasols[1],h=2.03;
    expect(sample(p.x-h*SHORE_SUN[0]/SHORE_SUN[1],p.z-h*SHORE_SUN[2]/SHORE_SUN[1])).toMatchObject({baked:110,live:255});
    expect(sample(p.x,p.z).baked).toBe(255);
    expect(sample(0,-5.48).rough).toBeLessThan(sample(0,-3).rough);
  }finally{low.dispose();high.dispose();}
});
