import {expect,it} from 'vitest';
import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {resolveStageLighting} from '../stage/lighting';
import {roomSets} from './roomSets';
import {platformGeometry} from './terminus/platformFinish';

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
    const shade=sample(0,-4),sun=sample(-2.6,-4);
    expect(shade.x).toBeLessThan(shade.z);
    expect(shade.z).toBeLessThan(sun.z);
    expect(sun.toArray()).toEqual([1,1,1]);
    expect(sample(8,-12).distanceTo(sun)).toBeLessThan(1e-6);
    expect(realShadows.hasAttribute('color')).toBe(false);
  }finally{deck.geometry.dispose();deck.material.dispose();realShadows.dispose();}
});
