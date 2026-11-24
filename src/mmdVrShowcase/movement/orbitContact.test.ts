import {Quaternion,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {altitude} from './orbitalSurfaces';
import {startOrbit,stepOrbit} from './orbitalFlight';
import {seatOrbitContact} from './orbitContact';
import {createTraveller,north} from './planetTravel';

it.each(['head','body'] as const)('%s-first capture reanchors the tracking space without displacing either the sole or the eyes',part=>{
  const {pad,target}=leapRoutes[0],up=part==='head'?pad.up:north,display=new Quaternion().setFromUnitVectors(north,up),p=new Vector3(.09,1.86,-.08);
  const s={...createTraveller(),groundTilt:new Quaternion(),seat:new Vector3(),offset:new Vector3(.06,0,-.04),viewUp:up.clone(),display};
  s.basis.copy(display);s.up.copy(up);
  const eye=p.clone().sub(s.offset).applyQuaternion(display),start=target.foot.clone().addScaledVector(target.up,3.8).addScaledVector(up,part==='body'?-.9:0);
  const f=startOrbit(pad.moon,start,target.up.clone().multiplyScalar(-3.5));
  for(let i=0;i<400&&!f.landing;i++)stepOrbit(f,1/90,up,eye);
  expect(f.landing).toBe(target.moon);expect(f.part).toBe(part);
  const contactEye=f.foot.clone().add(eye);seatOrbitContact(s,f,target.moon,p,eye,p.y);
  const final=s.basis.clone().multiply(s.groundTilt),shown=s.foot.clone().add(p.clone().sub(s.offset).add(s.seat).applyQuaternion(final));
  expect(s.grounded).toBe(true);expect(s.velocity.lengthSq()).toBe(0);expect(altitude(target.moon,s.foot)).toBeCloseTo(0,5);
  expect(final.angleTo(display)).toBeLessThan(1e-6);expect(shown.distanceTo(contactEye)).toBeLessThan(1e-8);
  for(const world of [pad.moon,target.moon])for(const h of [0,.15,.55,1,1.5,p.y])expect(altitude(world,shown.clone().addScaledVector(up,h-p.y))).toBeGreaterThan(-.001);
});
