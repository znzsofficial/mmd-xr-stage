import {Quaternion,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {altitude,shellRadius,walkWorlds} from './orbitalSurfaces';
import {startJump,startOrbit,stepOrbit} from './orbitalFlight';
import {seatOrbitContact} from './orbitContact';
import {createTraveller,north} from './planetTravel';
import {carryLocalHop} from './planetStance';

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

it('sulfur: follow a fast radial arc, retry from an offset ankle, and seat the attitude the final sweep actually tested',()=>{
  const w=walkWorlds.find(w=>w.id==='sulfur')!,n=new Vector3(.786,.608,.114).normalize(),p=new Vector3(0,1.2,0),lift=.6;
  const s={...createTraveller(),groundTilt:new Quaternion(),seat:new Vector3(),offset:new Vector3(),viewUp:n.clone(),display:new Quaternion().setFromUnitVectors(north,n)};
  s.basis.copy(s.display);s.up.copy(n);s.foot.copy(w.centre).addScaledVector(n,shellRadius(w,n.x,n.y,n.z));
  const read=()=>{},head=new Vector3(),sweptEye=new Vector3(),sweptUp=new Vector3();let peakRate=0;
  for(let jump=0;jump<2;jump++){
    const f=startJump(w,s.foot,s.up,new Vector3(0,0,1).projectOnPlane(s.up).normalize(),2.4),sweep=f.sweep;
    f.sweep=(...args)=>{sweptEye.copy(args[3]);sweptUp.copy(args[2]);return sweep(...args);};
    for(let i=0;i<500&&!f.landing;i++){
      // Put the actual ankle on a slightly different radial during descent.
      // The next jump must work despite the retained sub-degree difference.
      if(jump===0&&i===170)p.x+=.018;
      const dt=1/120,prev=s.viewUp.clone(),local=p.clone().sub(s.offset).add(s.seat);local.y+=lift;
      stepOrbit(f,dt,s.viewUp,head.copy(local).applyQuaternion(s.display),read,p.y+lift,(next,h)=>{
        carryLocalHop(w,s,f.foot,next,local,read,h);head.copy(local).applyQuaternion(s.display);
      });
      peakRate=Math.max(peakRate,prev.angleTo(s.viewUp)/dt);
      expect(s.viewUp.angleTo(f.foot.clone().sub(w.centre))).toBeLessThan(.012);
      expect(altitude(w,f.foot.clone().add(head))).toBeGreaterThan(1.76);
    }
    expect(f.landing).toBe(w);expect(f.changes).toBe(0);expect(head.distanceTo(sweptEye)).toBeLessThan(1e-9);
    expect(s.viewUp.angleTo(sweptUp)).toBeLessThan(1e-7);const displayed=s.display.clone();
    expect(seatOrbitContact(s,f,w,p,head,p.y+lift)).toBe(true);
    expect(s.basis.clone().multiply(s.groundTilt).angleTo(displayed)).toBeLessThan(1e-7);
    const residue=s.groundTilt.angleTo(new Quaternion());expect(residue).toBeLessThan(.014);if(!jump)expect(residue).toBeGreaterThan(1e-6);
  }
  expect(peakRate).toBeGreaterThan(.65);
});
