import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {shellRadius} from '../movement/orbitalSurfaces';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {lanes,launchViews,returnViews} from '../scenery/planet/windAtlas';
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
