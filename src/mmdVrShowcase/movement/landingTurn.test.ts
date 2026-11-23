import {Quaternion,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {altitude,shellRadius} from './orbitalSurfaces';
import {advanceCut,landingCut} from './landingTurn';
import {north} from './planetTravel';
import {startOrbit,stepOrbit} from './orbitalFlight';

it.each(leapRoutes)('$pad.id → $target.id: both visible endpoints of the cut have full head clearance',({pad,target})=>{
  const oldBasis=new Quaternion().setFromUnitVectors(north,pad.up),eye=new Vector3(.07,1.95,.09);
  const approach=target.foot.clone().addScaledVector(target.up,eye.y).addScaledVector(pad.up,-eye.y);
  const ground=target.moon.centre.clone().addScaledVector(target.up,shellRadius(target.moon,target.up.x,target.up.y,target.up.z));
  const standing=oldBasis.clone().premultiply(new Quaternion().setFromUnitVectors(pad.up,target.up));
  const c=landingCut(approach,oldBasis),point=new Vector3();let switched=0,t=0;
  for(;t<.25;t+=1/72){
    const wasCut=c.cut,done=advanceCut(c,1/72);
    if(!wasCut&&c.cut){switched++;expect(c.opacity).toBe(1);}
    for(const h of [0,.16,.6,1.1,1.65,eye.y])for(const world of [pad.moon,target.moon]){
      point.copy(eye).setY(h).applyQuaternion(c.cut?standing:oldBasis).add(c.cut?ground:approach);
      expect(altitude(world,point)).toBeGreaterThan(-.001);
    }
    if(done)break;
  }
  expect(switched).toBe(1);expect(c.opacity).toBe(0);expect(t).toBeLessThan(.20);
});

it.each(['head','body'] as const)('a free %s-first strike has a clear standing endpoint on the real contact surface',part=>{
  const {pad,target}=leapRoutes[0],up=part==='head'?pad.up:north,eye=up.clone().multiplyScalar(1.86);
  const start=target.foot.clone().addScaledVector(target.up,3.8).addScaledVector(up,part==='body'?-.90:0);
  const f=startOrbit(pad.moon,start,target.up.clone().multiplyScalar(-3.5));
  for(let i=0;i<400&&!f.landing;i++)stepOrbit(f,1/90,up,eye);
  expect(f.landing).toBe(target.moon);expect(f.part).toBe(part);expect(altitude(target.moon,f.point)).toBeCloseTo(0,5);
  for(const world of [pad.moon,target.moon])for(const h of [0,.15,.8,1.4,1.86])expect(altitude(world,f.point.clone().addScaledVector(f.up,h))).toBeGreaterThan(-.001);
});
