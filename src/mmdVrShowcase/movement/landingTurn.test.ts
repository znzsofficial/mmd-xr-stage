import {Quaternion,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {altitude,shellRadius} from './orbitalSurfaces';
import {standingArrival,riseToFeet,landingTurnRate} from './landingTurn';
import {createTraveller,north,transport} from './planetTravel';
import {moonWalk} from './moonWalk';
import {startOrbit,stepOrbit} from './orbitalFlight';

it.each(leapRoutes)('$pad.id → $target.id: opposed arrival stays outside both worlds from sole to head and finishes on the footprint',({pad,target,crest})=>{
  const eye=new Vector3(.07,1.95,.09),q=new Quaternion().setFromUnitVectors(north,pad.up);
  const foot=target.foot.clone().addScaledVector(target.up,eye.y).addScaledVector(pad.up,-eye.y);
  const finish=q.clone().premultiply(new Quaternion().setFromAxisAngle(crest,Math.PI)),s=standingArrival(foot,q);
  let done=false,max=0;const dt=1/36,prev=q.clone(),p=new Vector3();
  for(let i=0;i<360&&!done;i++){
    prev.copy(s.basis);done=riseToFeet(s,dt,eye,target.foot,finish,target.moon.id);max=Math.max(max,s.basis.angleTo(prev)/dt);
    for(const h of [0,.16,.6,1.1,1.65,eye.y])for(const m of [pad.moon,target.moon]){
      p.copy(eye).setY(h).applyQuaternion(s.basis).add(s.foot);expect(altitude(m,p)).toBeGreaterThan(-.001);
    }
  }
  expect(done).toBe(true);expect(s.foot.distanceTo(target.foot)).toBeLessThan(.0001);expect(max).toBeLessThanOrEqual(landingTurnRate+.00001);
});

it.each(['head','body'] as const)('recovers from a real %s-first sweep onto the steep rim and continues walking during the turn',part=>{
  const {pad,target}=leapRoutes[0],m=target.moon,normal=target.up;
  const up=part==='head'?pad.up:north,localEye=new Vector3(0,1.86,0),q=new Quaternion().setFromUnitVectors(north,up);
  const foot=target.foot.clone().addScaledVector(normal,3.8).addScaledVector(up,part==='body'?-.90:0);
  const f=startOrbit(pad.moon,foot,normal.clone().multiplyScalar(-3.5));
  for(let i=0;i<400&&!f.landing;i++)stepOrbit(f,1/90,up,localEye.clone().applyQuaternion(q));
  expect(f.landing).toBe(m);expect(f.part).toBe(part);
  const s=standingArrival(f.foot,q),walker=createTraveller();walker.foot.copy(f.point);walker.up.copy(up);walker.basis.copy(q);transport(walker,m.centre);
  let done=false;const dt=1/50,d=new Vector3();
  for(let i=0;i<450&&!done;i++){
    d.set(0,0,1).projectOnPlane(walker.up).normalize();moonWalk(m,walker,d,i<75?.85:0,dt,false,shellRadius);
    expect(walker.grounded).toBe(true);expect(altitude(m,walker.foot)).toBeCloseTo(0,5);
    done=riseToFeet(s,dt,localEye,walker.foot,walker.basis,m.id);
    for(const h of [0,.15,.8,1.4,localEye.y])expect(altitude(m,new Vector3(0,h,0).applyQuaternion(s.basis).add(s.foot))).toBeGreaterThan(-.001);
  }
  expect(done).toBe(true);expect(s.foot.distanceTo(f.point)).toBeGreaterThan(.7);expect(altitude(m,s.foot)).toBeCloseTo(0,5);
});

it('does not wait forever on the same blocked step after the visitor leans across an opposed shell',()=>{
  const {pad,target}=leapRoutes[0],eye=new Vector3(2.8,1.7,1.8);
  const from=new Quaternion().setFromUnitVectors(north,pad.up),finish=from.clone().premultiply(new Quaternion().setFromAxisAngle(north,Math.PI));
  const s=standingArrival(target.foot.clone().addScaledVector(target.up,.12),from);
  // Tracking is input to each synthetic sweep. Lean, hold for a while,
  // then return to standing normally without a key press or a new landing.
  for(let i=0;i<75;i++)riseToFeet(s,1/72,eye,target.foot,finish,target.moon.id);
  eye.set(0,1.7,0);let done=false;
  for(let i=0;i<600&&!done;i++)done=riseToFeet(s,1/72,eye,target.foot,finish,target.moon.id);
  expect(done).toBe(true);expect(altitude(target.moon,s.foot)).toBeCloseTo(0,5);
});
