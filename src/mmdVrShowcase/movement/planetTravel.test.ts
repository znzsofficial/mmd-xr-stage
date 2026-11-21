import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {newStick,readStick} from './controllerInput';
import {createTraveller,planetCentre,surfaceStep,transport} from './planetTravel';
import {WALK_SPEED} from '../mmdVrQuality';
import {crustRadius} from '../scenery/planet/opalTerrain';

it('reads the current Touch Plus source while its profile is pending, ignores hand/pad axes and drops disconnected state',()=>{
  const source={handedness:'right',targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[1,-1,-.77,.63],buttons:[{},{},{},{},{pressed:true}]}};
  const sources=(...s:unknown[])=>s as XRInputSourceArray,out=newStick();
  readStick(sources({...source,hand:{}},source),'right',undefined,out);expect(out).toEqual({via:'native',x:-.77,y:.63,primary:true});
  const short={...source,gamepad:{...source.gamepad,axes:[1,-1],buttons:[]}} as unknown as XRInputSource;
  const profile={inputSource:short,gamepad:{'xr-standard-thumbstick':{xAxis:-.3,yAxis:.4}}};
  readStick(sources(short),'right',profile,out);expect(out).toEqual({via:'profile',x:-.3,y:.4,primary:false});
  readStick(sources({...short}),'right',profile,out);expect(out).toEqual({via:'none',x:0,y:0,primary:false});
  const left={...short,handedness:'left'} as XRInputSource;
  readStick(sources(left),'left',{inputSource:left,gamepad:{'x-button':{state:'pressed'}}},out);expect(out.primary).toBe(true);
  readStick(sources(),'right',profile,out);expect(out.via).toBe('none');
});

it('walks a full circuit without Rapier, transports heading at the antipode and lands after a single jump',()=>{
  const s=createTraveller(),v=new Vector3();s.foot.set(0,0,0);transport(s);
  const dt=1/120;let travel=0,minUp=1,maxAltitude=0;
  for(let i=0;i<3900;i++){
    v.set(0,0,-1).applyQuaternion(s.basis);const last=s.up.clone(),radius=s.foot.distanceTo(planetCentre);surfaceStep(s,v,WALK_SPEED.normal,dt,i===1800,()=>{},1.8);
    travel+=last.angleTo(s.up)*radius;minUp=Math.min(minUp,s.up.y);
    if(i>=1800&&i<2000)maxAltitude=Math.max(maxAltitude,s.foot.distanceTo(planetCentre)-crustRadius(s.up.x,s.up.y,s.up.z));
    expect(v.dot(new Vector3(0,0,-1).applyQuaternion(s.basis))).toBeGreaterThan(.99);
  }
  expect(minUp).toBeLessThan(-.999);expect(travel).toBeCloseTo(3900*dt*2.4,2);
  expect(maxAltitude).toBeGreaterThan(.35);expect(s.grounded).toBe(true);expect(s.foot.distanceTo(planetCentre)).toBeGreaterThanOrEqual(12-1e-5);
});
