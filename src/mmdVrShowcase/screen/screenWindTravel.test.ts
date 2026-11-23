import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {shellRadius} from '../movement/orbitalSurfaces';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {lanes,launchViews,returnViews} from '../scenery/planet/windAtlas';
import {screenWindTravel} from './screenWindTravel';
import {tideShots} from '../scenery/planet/tideShots';
import {tideCentre,tideFloor,tideDatum} from '../scenery/planet/tideLayout';
import {createTideClock} from '../scenery/planet/tideClock';
import {bindTide} from '../scenery/planet/tideSession';

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

it('boards 07 on screen and can walk back to its return collar after inspecting the actor in the grotto',()=>{
  const lane=lanes.find(l=>l.moon.id==='tide')!,travel=screenWindTravel(()=>{},()=>{}),dt=1/45,d=new Vector3();
  const eye=new Vector3().fromArray(launchViews.find(v=>v.key==='tideWind')!.eye);
  function tick(){travel.walk(eye,d,dt);eye.add(d);}
  function board(){travel.pass(eye,d);for(let i=0;i<(lane.duration+.1)/dt;i++){d.set(0,0,0);tick();}}
  board();expect(eye.distanceTo(new Vector3().fromArray(returnViews.find(v=>v.key==='tideReturn')!.eye))).toBeLessThan(.001);
  // A tour resets the old ride. The portrait camera must re-acquire actual
  // standing support so WASD follows the steps rather than flying through rock.
  for(const view of tideShots){
    travel.dispose();eye.fromArray(view.eye);const start=eye.clone();travel.survey(eye,true);
    expect(travel.floorUp(eye),view.key).not.toBeNull();
    d.set(.025,0,0);tick();expect(eye.distanceTo(start)).toBeGreaterThan(.010);
    expect(eye.distanceTo(start)).toBeLessThan(.065);expect(travel.floorUp(eye)).not.toBeNull();
  }
  const stage=tideShots.find(v=>v.key==='tideStage')!;eye.fromArray(stage.eye);travel.survey(eye,true);
  for(const x of [1,0]){
    const goal=new Vector3(tideCentre.x+x,tideDatum+tideFloor(x,0),tideCentre.z).sub(tideCentre).normalize();
    for(let i=0;i<160&&travel.floorUp(eye)!.angleTo(goal)>.008;i++){
      d.copy(goal).projectOnPlane(travel.floorUp(eye)!).setLength(2.4*dt);tick();
    }
    expect(travel.floorUp(eye)!.angleTo(goal)).toBeLessThan(.008);
  }
  board();expect(eye.distanceTo(lane.home.foot.clone().add(new Vector3(0,1.65,0)))).toBeLessThan(.001);
});

it('the same walk covers less ground at flood on the shell steps but the same distance along the dry bank',()=>{
  const scene={},clock=createTideClock(),unbind=bindTide(scene,clock),moon=lanes.find(l=>l.moon.id==='tide')!.moon;
  function distance(z:number){
    const travel=screenWindTravel(()=>{},()=>{},scene),dt=1/72,x=2.80;
    const start=new Vector3(tideCentre.x+x,tideDatum+tideFloor(x,z),tideCentre.z+z),eye=start.clone();eye.y+=1.56;
    travel.survey(eye,true);const d=new Vector3();
    for(let i=0;i<8;i++){
      d.set(1,0,0).projectOnPlane(travel.floorUp(eye)!).setLength(2.4*dt);
      travel.walk(eye,d,dt);eye.add(d);
    }
    const n=travel.floorUp(eye)!,end=tideCentre.clone().addScaledVector(n,shellRadius(moon,n.x,n.y,n.z));
    travel.dispose();return start.distanceTo(end);
  }
  try{
    const low=distance(0),dry=distance(1.45);clock.turn();for(let i=0;i<50;i++)clock.step(.1);
    const flood=distance(0);expect(low).toBeGreaterThan(.23);expect(flood/low).toBeGreaterThan(.50);expect(flood/low).toBeLessThan(.85);
    expect(dry).toBeGreaterThan(.23);expect(distance(1.45)).toBeCloseTo(dry,6);
  }finally{unbind();}
});
