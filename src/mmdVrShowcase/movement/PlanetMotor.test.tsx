// @vitest-environment jsdom
import {act,useLayoutEffect,type RefObject} from 'react';
import {createRoot} from 'react-dom/client';
import {Group,Scene,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import PlanetMotor from './PlanetMotor';
import type {PlanetDriver,Traveller} from './planetTravel';
import {samplePlanetMovement} from './planetDiagnostics';
import {useMmdVrStore} from '../mmdVrStore';
import {lanes} from '../scenery/planet/windAtlas';
import {useBackpack} from '../backpack';

const h=vi.hoisted(()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});
  return {module:{promise,resolve},ready:true,frame:null as Function|null,seed:vi.fn(),step:vi.fn()};});
vi.mock('@react-three/fiber',()=>({useFrame:(cb:Function)=>{h.frame=cb;}}));
vi.mock('@react-three/xr',()=>({useXRInputSourceState:()=>undefined}));
vi.mock('./PlanetPhysics',async()=>{await h.module.promise;return {default:({driver}:{driver:RefObject<PlanetDriver|null>})=>{
  useLayoutEffect(()=>{driver.current={ready:()=>h.ready,seed:h.seed,step:h.step,stop:()=>{}};
    return()=>{driver.current=null;};},[driver]);return null;}};});

it('keeps both sticks live with no profile and no physics module, then hands off the same foot and latched snap',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const state=useMmdVrStore.getState();useMmdVrStore.setState({prefs:{...state.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal'}});
  const root=createRoot(document.createElement('div')),origin=new Group(),xr={getReferenceSpace:()=>({})},scene=new Scene();
  const source=(hand:string,x:number,y:number)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,x,y],buttons:[]}});
  const sources=[source('left',0,-1),source('right',1,0)],pose={transform:{position:{x:.13,y:1.52,z:-.21},orientation:{x:0,y:0,z:0,w:1}}};
  const tick=()=>h.frame!({gl:{xr},scene},1/90,{session:{visibilityState:'visible',inputSources:sources},getViewerPose:()=>pose});
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));
    for(let i=0;i<90;i++)tick();
    expect(samplePlanetMovement()).toMatchObject({backend:'pending',walkInputFrames:90,snapTurns:1,left:'native',right:'native'});
    expect(samplePlanetMovement()!.footTravelM).toBeGreaterThan(2.3);
    sources[0].gamepad.axes[3]=0;tick();const previous=origin.matrixWorld.clone();
    await act(async()=>{h.module.resolve();await h.module.promise;});tick();
    expect(h.seed).toHaveBeenCalledOnce();expect(h.step).not.toHaveBeenCalled();expect(previous.equals(origin.matrixWorld)).toBe(true);
    tick();expect(h.step).toHaveBeenCalledOnce();expect(samplePlanetMovement()).toMatchObject({backend:'rapier',snapTurns:1});
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(state);vi.unstubAllGlobals();}
  expect(samplePlanetMovement()).toBeUndefined();
});

it('does not hand a flight to a late Rapier driver or launch twice on a held X; reseeds only after return',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const old=useMmdVrStore.getState(),bag=useBackpack.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal'}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  h.ready=false;h.seed.mockClear();h.step.mockClear();h.module.resolve();
  const lane=lanes[0],button={pressed:false},source={handedness:'left',targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:[{},{},{},{},button]}};
  const p={x:0,y:1.65,z:0},pose={transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}};let tracked=true;
  const tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/72,{session:{visibilityState:'visible',inputSources:[source]},getViewerPose:()=>tracked?pose:null});
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld);
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    // Room-scale tracking puts the visitor in the collar with no joystick movement.
    const delta=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());p.x=delta.x;p.z=delta.z;
    useBackpack.setState({draft:'pending'});button.pressed=true;tick();expect(samplePlanetMovement()?.windDepartures).toBe(0);
    useBackpack.setState({draft:null});button.pressed=false;tick();button.pressed=true;for(let i=0;i<130;i++)tick();
    expect(samplePlanetMovement()?.windDepartures).toBe(1);h.ready=true;tracked=false;const frozen=origin.matrixWorld.clone();for(let i=0;i<50;i++)tick();expect(origin.matrixWorld.equals(frozen)).toBe(true);
    tracked=true;for(let i=0;i<720;i++)tick();expect(foot().distanceTo(lane.away.foot)).toBeLessThan(.002);expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
    button.pressed=false;tick();button.pressed=true;for(let i=0;i<720;i++)tick();
    expect(samplePlanetMovement()).toMatchObject({windDepartures:2,windLandings:2});expect(foot().distanceTo(lane.home.foot)).toBeLessThan(.002);expect(h.seed).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);useBackpack.setState(bag);h.ready=true;vi.unstubAllGlobals();}
});

it('requires settled support even while the Rapier suspension cast still reports ground on jump and descent',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene(),lane=lanes[0];
  const source=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:5},()=>({pressed:false}))}});
  const left=source('left'),right=source('right'),x=left.gamepad.buttons[4],a=right.gamepad.buttons[4],p={x:0,y:1.65,z:0};
  const tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/72,{session:{visibilityState:'visible',inputSources:[left,right]},getViewerPose:()=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}})});
  let radialSpeed=0;h.module.resolve();h.ready=true;h.step.mockImplementation((s:Traveller)=>{s.grounded=true;s.velocity.copy(s.up).multiplyScalar(radialSpeed);});
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    const offset=lane.home.foot.clone().sub(origin.position).applyQuaternion(origin.quaternion.clone().invert());p.x=offset.x;p.z=offset.z;
    a.pressed=true;tick();a.pressed=false;x.pressed=true;radialSpeed=2.4;tick();
    expect(samplePlanetMovement()?.windDepartures).toBe(0); // cast and velocity still stale on the first X frame
    x.pressed=false;tick();x.pressed=true;tick();expect(samplePlanetMovement()?.windDepartures).toBe(0);
    radialSpeed=-1.2;x.pressed=false;tick();x.pressed=true;tick();radialSpeed=0;for(let i=0;i<6;i++)tick();
    expect(samplePlanetMovement()?.windDepartures).toBe(0);x.pressed=false;tick();x.pressed=true;tick();
    expect(samplePlanetMovement()).toMatchObject({windDepartures:1,location:'wind'});
  }finally{h.step.mockReset();await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});
