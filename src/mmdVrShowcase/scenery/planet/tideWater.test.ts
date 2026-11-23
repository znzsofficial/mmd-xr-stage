import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {ebbLevel,floodLevel} from './tideClock';
import {tideCentre,tideDatum,tideDeck,tideFloor,tideWaterFootprint} from './tideLayout';
import {tidePool} from './tideWater';
import {reedCentre} from './reedBiosphere';
import {tideShots} from './tideShots';

it('floods the stair treads but not the side path, deck or return terminal, and never dries the rock pool',()=>{
  for(const x of [2.01,2.37,2.76,3.05]){expect(tideFloor(x,0)).toBeGreaterThan(ebbLevel);expect(tideFloor(x,0)).toBeLessThan(floodLevel);}
  for(let x=0;x<=5.5;x+=.09)expect(tideFloor(x,1.45)).toBeGreaterThan(floodLevel);
  expect(tideFloor(3.05,-1.38)).toBeLessThan(ebbLevel);expect(tideDeck.y-tideDatum).toBeGreaterThan(floodLevel);expect(tideFloor(0,0)).toBeGreaterThan(floodLevel);
  const water=tidePool(),pos=water.attributes.position,bed=water.attributes.bed,ix=water.index!;
  try{for(let i=0;i<ix.count;i+=81){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
    const avg=(f:(n:number)=>number)=>ids.reduce((s,n)=>s+f(n)/3,0);
    expect(avg(n=>bed.getX(n))).toBeCloseTo(tideFloor(avg(n=>pos.getX(n)),avg(n=>pos.getZ(n))),4);
  }}finally{water.dispose();}
});

it('places the reflection of the actual neighbouring world on wetted rock at high water',()=>{
  const shot=tideShots.find(v=>v.key==='tideMoonrise')!,eye=new Vector3().fromArray(shot.eye);
  expect(tideFloor(eye.x-tideCentre.x,eye.z-tideCentre.z)).toBeGreaterThan(floodLevel);
  const mirror=reedCentre.clone();mirror.y=2*(tideDatum+floodLevel)-mirror.y;
  const t=(eye.y-tideDatum-floodLevel)/(eye.y-mirror.y),hit=eye.clone().lerp(mirror,t);
  expect(tideWaterFootprint(hit.x-tideCentre.x,hit.z-tideCentre.z)).toBe(true);
  expect(tideFloor(hit.x-tideCentre.x,hit.z-tideCentre.z)).toBeLessThan(floodLevel-.1);
  const reflected=hit.clone().sub(eye).normalize().reflect(new Vector3(0,1,0));expect(reflected.dot(reedCentre.clone().sub(hit).normalize())).toBeCloseTo(1,9);
});
