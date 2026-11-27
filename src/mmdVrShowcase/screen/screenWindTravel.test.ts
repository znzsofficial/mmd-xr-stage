import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {shellRadius} from '../movement/orbitalSurfaces';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {amberMoon,lanes,launchViews,returnViews} from '../scenery/planet/windAtlas';
import {screenWindTravel} from './screenWindTravel';

it('lands from the Lantern wind, walks its curved trail, hops both ways and boards the homeward collar on foot',()=>{
  const lane=lanes.find(l=>l.moon.id==='lantern')!,route=leapRoutes.find(r=>r.pad.moon===lane.moon)!,dt=1/45;
  const eye=new Vector3().fromArray(launchViews.find(v=>v.key==='lanternWind')!.eye),d=new Vector3();
  const travel=screenWindTravel(()=>{},()=>{});
  const tick=()=>{travel.walk(eye,d,dt);eye.add(d);};
  const idle=(seconds:number)=>{for(let i=0;i<seconds/dt;i++){d.set(0,0,0);tick();}};
  function approach(to:Vector3){
    for(let i=0;i<300;i++){
      const n=travel.floorUp(eye)!;
      const ground=shellRadius(lane.moon,n.x,n.y,n.z);expect(eye.distanceTo(lane.moon.centre)-ground).toBeCloseTo(1.65,4);
      if(n.angleTo(to)<.012)return;
      d.copy(to).projectOnPlane(n).setLength(2.4*dt);tick();
    }
    throw new Error('trail blocked before the footprint');
  }
  travel.pass(eye,d);idle(lane.duration+.1);expect(eye.distanceTo(new Vector3().fromArray(returnViews.find(v=>v.key==='lanternReturn')!.eye))).toBeLessThan(.001);
  approach(route.pad.up);
  for(const target of [route.target,route.pad]){
    travel.jump(eye);idle(6);expect(travel.floorUp(eye)?.dot(target.up)).toBeGreaterThan(.999);
    expect(eye.distanceTo(target.foot.clone().addScaledVector(target.up,1.65))).toBeLessThan(.035);
  }
  approach(lane.away.up);travel.pass(eye,d);idle(lane.duration+.1);
  expect(eye.distanceTo(lane.home.foot.clone().add(new Vector3(0,1.65,0)))).toBeLessThan(.001);expect(travel.floorUp(eye)).toBeNull();
});

it('resumes the same first walking step after an actor close-up from a tilted lunar path',()=>{
  const moon=amberMoon,n=new Vector3(-.3,1,.3).normalize(),travel=screenWindTravel(()=>{},()=>{});
  const eye=moon.centre.clone().addScaledVector(n,shellRadius(moon,n.x,n.y,n.z)+1.65),dt=1/60;travel.survey(eye,true);
  function step(){const d=new Vector3(.035,0,0);travel.walk(eye,d,dt);eye.add(d);}
  step();const saved=eye.clone(),up=travel.floorUp(eye)!.clone(),resume=travel.rememberGround(eye)!;
  step();const expected=eye.clone();expect(expected.distanceTo(saved)).toBeGreaterThan(.02);travel.dispose();eye.copy(saved);
  expect(travel.floorUp(eye)).toBeNull();resume();expect(travel.floorUp(eye)?.distanceTo(up)).toBeLessThan(1e-9);
  step();expect(eye.distanceTo(expected)).toBeLessThan(1e-6);
});
