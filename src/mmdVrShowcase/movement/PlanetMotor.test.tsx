// @vitest-environment jsdom
import {act,useLayoutEffect,type RefObject} from 'react';
import {createRoot} from 'react-dom/client';
import {BoxGeometry,Euler,Group,Mesh,MeshBasicMaterial,Quaternion,Scene,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import PlanetMotor from './PlanetMotor';
import type {PlanetDriver,Traveller} from './planetTravel';
import {homeStride} from './homeStride';
import {createHomeCapsule} from './homeCapsule';
import {addHomeTerrainSolids} from './homeTerrainSolids';
import {altitude,homeWorld} from './orbitalSurfaces';
import {samplePlanetMovement} from './planetDiagnostics';
import {useMmdVrStore} from '../mmdVrStore';
import {lanes} from '../scenery/planet/windAtlas';
import {surveyReaderBlocks,surveySites} from '../scenery/planet/opalSurvey';
import {useBackpack} from '../backpack/store';

const h=vi.hoisted(()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});
  return {module:{promise,resolve},ready:true,denied:false,session:null as EventTarget|null,frame:null as Function|null,seed:vi.fn(),step:vi.fn()};});
function visit<T>(inputSources:T[]){const session=Object.assign(new EventTarget(),{inputSources,visibilityState:'visible'});h.session=session;return session;}
vi.mock('@react-three/fiber',()=>({useFrame:(cb:Function)=>{h.frame=cb;}}));
vi.mock('@react-three/xr',()=>({useXRInputSourceState:()=>undefined,useXR:()=>h.session}));
vi.mock('./PlanetPhysics',async()=>{await h.module.promise;return {default:({driver}:{driver:RefObject<PlanetDriver|null>})=>{
  if(h.denied)throw new Error('optional WASM unavailable');
  useLayoutEffect(()=>{driver.current={ready:()=>h.ready,seed:h.seed,step:h.step,stop:()=>{}};
    return()=>{driver.current=null;};},[driver]);return null;}};});

it('keeps both sticks live with no profile and no physics module, then hands off the same foot and latched snap',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const state=useMmdVrStore.getState();useMmdVrStore.setState({prefs:{...state.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal'}});
  const root=createRoot(document.createElement('div')),origin=new Group(),xr={getReferenceSpace:()=>({})},scene=new Scene();
  const source=(hand:string,x:number,y:number)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,x,y],buttons:[]}});
  const sources=[source('left',0,-1),source('right',0,0)],pose={transform:{position:{x:.13,y:1.52,z:-.21},orientation:{x:0,y:0,z:0,w:1}}},session=visit(sources);
  const tick=()=>h.frame!({gl:{xr},scene},1/90,{session,getViewerPose:()=>pose});
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));
    tick();sources[1].gamepad.axes[2]=1;for(let i=1;i<90;i++)tick();
    expect(samplePlanetMovement()).toMatchObject({backend:'pending',walkInputFrames:90,snapTurns:1,left:'native',right:'native',orbitalJumps:0});
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
  const lane=lanes[0],button={pressed:false},y={pressed:false},source={handedness:'left',targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:[{},{},{},{},button,y]}};
  const p={x:0,y:1.65,z:0},pose={transform:{position:p,orientation:new Quaternion()}};let tracked=true;
  const a={pressed:false},right={...source,handedness:'right',gamepad:{...source.gamepad,axes:[0,0,0,0],buttons:[{},{},{},{},a]}};
  const session=visit([source,right]),tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/72,{session,getViewerPose:()=>tracked?pose:null});
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld);
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    // Room-scale tracking puts the visitor in the collar with no joystick movement.
    const delta=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());p.x=delta.x;p.z=delta.z;
    useBackpack.setState({draft:'pending'});button.pressed=true;tick();expect(samplePlanetMovement()?.windDepartures).toBe(0);
    useBackpack.setState({draft:null});button.pressed=false;tick();button.pressed=true;for(let i=0;i<130;i++)tick();
    expect(samplePlanetMovement()?.windDepartures).toBe(1);h.ready=true;tracked=false;const frozen=origin.matrixWorld.clone();for(let i=0;i<50;i++)tick();expect(origin.matrixWorld.equals(frozen)).toBe(true);
    tracked=true;for(let i=0;i<720;i++)tick();expect(foot().distanceTo(lane.away.foot)).toBeLessThan(.002);expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
    // A short unmarked tangential hop stays inside the return collar. Keep
    // that horizon on touchdown, then take the wind back without first using Y.
    button.pressed=false;tick();const north=new Vector3(0,1,0),start=origin.quaternion.clone();
    a.pressed=true;source.gamepad.axes[3]=-.32;tick();a.pressed=false;source.gamepad.axes[3]=0;
    for(let i=0;i<180;i++)tick();expect(samplePlanetMovement()).toMatchObject({orbitalLandings:1,alignments:0});
    expect(origin.quaternion.angleTo(start)).toBeLessThan(1e-6);expect(foot().sub(lane.moon.centre).normalize().angleTo(north.clone().applyQuaternion(start))).toBeGreaterThan(.05);
    button.pressed=true;for(let i=0;i<720;i++){
      const before=origin.quaternion.clone();pose.transform.orientation.setFromEuler(new Euler(.22,.91*Math.sin(i/83),-.3,'YXZ'));
      tick();expect(origin.quaternion.angleTo(before)).toBeLessThan(.01);
    }
    expect(north.clone().applyQuaternion(origin.quaternion).angleTo(lane.home.up)).toBeLessThan(1e-6);
    expect(samplePlanetMovement()?.alignments).toBe(0);
    expect(samplePlanetMovement()).toMatchObject({windDepartures:2,windLandings:2});expect(foot().distanceTo(lane.home.foot)).toBeLessThan(.002);expect(h.seed).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);useBackpack.setState(bag);h.ready=true;vi.unstubAllGlobals();}
});

it('consumes airborne wind presses and parks a ready suspension through an ordinary mother-planet jump',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene(),lane=lanes[0];
  const source=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:5},()=>({pressed:false}))}});
  const left=source('left'),right=source('right'),x=left.gamepad.buttons[4],a=right.gamepad.buttons[4],p={x:0,y:1.65,z:0};
  const session=visit([left,right]),tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/72,{session,getViewerPose:()=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}})});
  h.module.resolve();h.ready=true;h.step.mockClear();h.step.mockImplementation((s:Traveller)=>{s.grounded=true;s.velocity.set(0,0,0);});
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    const offset=lane.home.foot.clone().sub(origin.position).applyQuaternion(origin.quaternion.clone().invert());p.x=offset.x;p.z=offset.z;
    a.pressed=true;tick();a.pressed=false;x.pressed=true;tick();
    expect(samplePlanetMovement()).toMatchObject({location:'orbit',windDepartures:0});expect(h.step).not.toHaveBeenCalled();
    x.pressed=false;tick();x.pressed=true;for(let i=0;i<300;i++)tick();
    const actual=new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld),toCollar=lane.home.foot.clone().sub(actual).applyQuaternion(origin.quaternion.clone().invert());p.x+=toCollar.x;p.z+=toCollar.z;
    tick();tick();
    expect(samplePlanetMovement()?.windDepartures).toBe(0);x.pressed=false;tick();x.pressed=true;tick();
    expect(samplePlanetMovement()).toMatchObject({windDepartures:1,location:'wind'});
  }finally{h.step.mockReset();await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it.each(['ready at takeoff','ready during hop'])('%s: side-looking home hop carries the local horizon before touchdown and resumes a supported stride without Y',async when=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState(),initiallyReady=when!=='ready during hop';
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const left=input('left'),right=input('right'),p={x:.16,y:1.66,z:-.23},a=right.gamepad.buttons[4],stick=left.gamepad.axes;
  const head=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.83);
  const session=visit([left,right]),tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session,getViewerPose:()=>({transform:{position:p,orientation:head}})});
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld);
  let loose=false;const stride=homeStride(),support=new Vector3();h.module.resolve();h.ready=initiallyReady;h.seed.mockClear();h.step.mockClear();
  // Feed a moving suspension with a noisy altitude through the real sole solver.
  h.step.mockImplementation((s:Traveller,dt:number,x:number,forward:number)=>{
    const drive=new Vector3().crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward);
    const noisy=s.foot.clone().addScaledVector(drive,2.4*dt).addScaledVector(s.up,loose?.09:0);
    stride(s,noisy,drive.lengthSq()>0,dt,()=>{});support.copy(s.up);
  });
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    const start=foot();stick[3]=-(.16+.84*.15);a.pressed=true;tick();
    expect(samplePlanetMovement()?.location).toBe('orbit');a.pressed=false;stick[3]=0;p.x+=.10;h.ready=true;
    for(let i=0;i<700&&samplePlanetMovement()?.location==='orbit';i++){const old=origin.quaternion.clone();head.setFromAxisAngle(new Vector3(0,1,0),1.1);tick();expect(origin.quaternion.angleTo(old)).toBeLessThan(.008);}
    expect(samplePlanetMovement()).toMatchObject({location:'home',orbitalJumps:1,orbitalLandings:1,alignments:0});
    const landed=foot(),horizon=origin.quaternion.clone();expect(landed.distanceTo(start)).toBeGreaterThan(.4);
    for(let i=0;i<30;i++)tick();expect(origin.quaternion.angleTo(horizon)).toBeLessThan(1e-6);
    expect(h.seed).toHaveBeenCalledTimes(initiallyReady?2:1);
    loose=true;stick[3]=-1;
    for(let i=0;i<90;i++){if(i===30)loose=false;tick();expect(new Vector3(0,1,0).applyQuaternion(origin.quaternion).angleTo(foot().sub(homeWorld.centre))).toBeLessThan(.01);}
    expect(foot().distanceTo(landed)).toBeGreaterThan(2.25);expect(samplePlanetMovement()).toMatchObject({backend:'rapier',orbitalJumps:1,alignments:0});
    stick[3]=0;tick();const idle=origin.matrixWorld.clone();tick();expect(origin.matrixWorld.equals(idle)).toBe(true);
  }finally{h.step.mockReset();await act(async()=>root.unmount());useMmdVrStore.setState(old);h.ready=true;vi.unstubAllGlobals();}
});

it.each(['suspension','no WASM'])('%s: held-A east-flank reproduction lands once; released stick has no idle slide and long travel follows the changing normal',async backend=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:.2}});
  const root=createRoot(document.createElement('div'),{onCaughtError:()=>{}}),origin=new Group(),scene=new Scene(),dt=1/90;
  const source=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const left=source('left'),right=source('right'),p=new Vector3(.16,1.63,-.21),a=right.gamepad.buttons[4];
  const session=visit([left,right]),tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},dt,{session,getViewerPose:()=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}})});
  const up=()=>new Vector3(0,1,0).applyQuaternion(origin.quaternion),eye=()=>p.clone().applyMatrix4(origin.matrixWorld),foot=()=>eye().addScaledVector(up(),-p.y-.2);
  const stride=homeStride(),seeds:{p:Vector3;speed:number}[]=[];let bodySteps=0;
  h.ready=backend==='suspension';h.denied=!h.ready;h.module.resolve();h.seed.mockImplementation((s:Traveller)=>seeds.push({p:s.foot.clone(),speed:s.velocity.length()}));
  h.step.mockImplementation((s:Traveller,d:number,x:number,f:number)=>{bodySteps++;
    // A messy collision-resolved capsule (spring/radial noise + idle creep).
    const dir=new Vector3().crossVectors(s.dir,s.up).multiplyScalar(x||(f?0:.2)).addScaledVector(s.dir,f);
    stride(s,s.foot.clone().addScaledVector(dir,2.4*d).addScaledVector(s.up,bodySteps%2?.08:-.03),!!(x||f),d,()=>{});
  });
  function record(seconds:number,onFrame?:()=>void){let distance=0,last=foot();for(let i=0;i<Math.round(seconds/dt);i++){
    tick();const now=foot();distance+=last.distanceTo(now);last=now;onFrame?.();
  }return distance;}
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    left.gamepad.axes[2]=.99;expect(record(2.2)).toBeGreaterThan(4.5);a.pressed=true;const stepsBefore=bodySteps;
    tick();expect(samplePlanetMovement()?.location).toBe('orbit');expect(bodySteps).toBe(stepsBefore);
    let peak=0;record(3.6-dt,()=>{if(samplePlanetMovement()?.location==='orbit'){peak=Math.max(peak,altitude(homeWorld,foot()));expect(bodySteps).toBe(stepsBefore);}});
    expect(peak).toBeGreaterThan(.5);left.gamepad.axes[2]=0;
    expect(record(2.4)).toBeLessThan(.001);expect(altitude(homeWorld,foot())).toBeCloseTo(0,4);
    const before=up();a.pressed=false;record(3*dt);left.gamepad.axes[2]=.99;
    const residual=foot().sub(homeWorld.centre).normalize().angleTo(before);expect(residual).toBeLessThan(.001);
    expect(record(4.4,()=>{const radial=foot().sub(homeWorld.centre).normalize();expect(radial.angleTo(up())).toBeCloseTo(residual,3); })).toBeGreaterThan(7);
    expect(before.angleTo(up())).toBeGreaterThan(.45);left.gamepad.axes[2]=0;expect(record(1.2)).toBeLessThan(.001);
    expect(samplePlanetMovement()).toMatchObject({backend:h.denied?'failed':'rapier',location:'home',grounded:true,orbitalJumps:1,orbitalLandings:1,alignments:0});
    if(h.ready){expect(seeds).toHaveLength(2);expect(seeds[1].speed).toBe(0);expect(altitude(homeWorld,seeds[1].p)).toBeCloseTo(0,5);}
    // Tracked standing height/calibration never includes flight altitude.
    expect(useMmdVrStore.getState().prefs.normalEyeOffset).toBe(.2);expect(eye().distanceTo(foot())).toBeCloseTo(1.83,7);
  }finally{h.step.mockReset();h.seed.mockReset();await act(async()=>root.unmount());useMmdVrStore.setState(old);h.ready=true;h.denied=false;vi.unstubAllGlobals();}
});

it('free flight can carry the actual eye through the north compass and leave normal movement at the saved foot',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:[]}});
  const left=input('left'),right=input('right'),p=new Vector3(0,.82,0),up=new Vector3(0,1,0);
  const session=visit([left,right]),tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session,getViewerPose:()=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}})});
  const mode=(movementMode:'normal'|'free')=>useMmdVrStore.setState({prefs:{...useMmdVrStore.getState().prefs,movementMode}});
  h.ready=false;
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    const before=origin.position.clone();mode('free');tick();
    const eye=()=>p.clone().applyMatrix4(origin.matrixWorld),ray=surveySites.dial.lens.clone().sub(eye()).normalize();
    const direction=ray.clone().applyQuaternion(origin.quaternion.clone().invert());
    const axis=(v:number)=>v===0?0:Math.sign(v)*(.16+.84*Math.abs(v));
    left.gamepad.axes[2]=axis(direction.x);left.gamepad.axes[3]=axis(direction.z);right.gamepad.axes[3]=axis(-direction.y);
    let inside=false;
    for(let i=0;i<250;i++){tick();inside ||= surveyReaderBlocks(eye(),0,.001,up);}
    expect(inside).toBe(true);expect(eye().sub(surveySites.dial.lens).dot(ray)).toBeGreaterThan(.6);
    expect(samplePlanetMovement()).toMatchObject({location:'free',windDepartures:0});
    left.gamepad.axes.fill(0);right.gamepad.axes.fill(0);p.set(1.6,1.48,-1.2);mode('normal');tick();
    expect(eye().distanceTo(before.clone().addScaledVector(up.clone().applyQuaternion(origin.quaternion),p.y))).toBeLessThan(.002);
  }finally{h.ready=true;await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it.each([false,true])('normal route, A=%s: same walk, two snap turns, stop; clear eyes stay upright without Y',async jump=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0}});
  const {default:R}=await import('@dimforge/rapier3d-compat');await R.init();const world=new R.World({x:0,y:0,z:0});addHomeTerrainSolids(R,world);
  const driver=createHomeCapsule(R,world,()=>2.4);h.module.resolve();h.ready=true;h.seed.mockImplementation(driver.seed);h.step.mockImplementation(driver.step);
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const l=input('left'),r=input('right'),session=visit([l,r]),root=createRoot(document.createElement('div')),scene=new Scene(),origin=new Group();
  const p=new Vector3(.62,1.63,-.21),head=new Quaternion(),pose={transform:{position:p,orientation:head}},up=new Vector3(0,1,0);
  const eyes=[new Vector3(-.032,0,0),new Vector3(.032,0,0)],mid=()=>eyes.reduce((sum,e)=>sum.add(e.clone().applyQuaternion(head).add(p).applyMatrix4(origin.matrixWorld)),new Vector3()).multiplyScalar(.5);
  const tick=(n=1)=>{for(let i=0;i<n;i++)h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session,getViewerPose:()=>pose});};
  const level=()=>{const eye=mid();expect(up.clone().applyQuaternion(origin.quaternion).angleTo(eye.clone().sub(homeWorld.centre))).toBeLessThan(.002);
    expect(Math.abs(altitude(homeWorld,eye)-p.y)).toBeLessThan(.01);};
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick(3);
    // The visitor leans 25 cm while stopped (must stay physical), then pushes
    // the stick. A stale motor footprint would leave a >1 degree roll error.
    const prev=origin.matrixWorld.clone();p.x+=.25;tick();expect(Math.max(...prev.elements.map((v,i)=>Math.abs(v-origin.matrixWorld.elements[i])))).toBeLessThan(1e-8);
    l.gamepad.axes[3]=-1;tick(370);head.setFromAxisAngle(new Vector3(0,0,1),.28);tick(198);head.identity();tick(99);l.gamepad.axes[3]=0;tick(20);level();
    for(const side of [1,-1]){r.gamepad.axes[2]=side;tick(12);r.gamepad.axes[2]=0;tick(12);level();}
    l.gamepad.axes[3]=-1;r.gamepad.buttons[4].pressed=jump;tick(16);r.gamepad.buttons[4].pressed=false;tick(198);l.gamepad.axes[3]=0;tick(90);level();
    const path=samplePlanetMovement()!.groundedWalkM;l.gamepad.axes[3]=-1;tick(126);l.gamepad.axes[3]=0;tick();const rest=mid();tick(45);level();
    expect(mid().distanceTo(rest)).toBeLessThan(1e-6);expect(samplePlanetMovement()!.groundedWalkM-path).toBeGreaterThan(3);
    expect(samplePlanetMovement()).toMatchObject({grounded:true,snapTurns:2,orbitalJumps:Number(jump),orbitalLandings:Number(jump),alignments:0,wellChanges:0});
  }finally{await act(async()=>root.unmount());h.seed.mockReset();h.step.mockReset();driver.dispose();world.free();useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it('walks beyond the antipode with a turning, tilted head; a home hop stays upright and Y still seats an uphill physical step',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0}});
  const {default:R}=await import('@dimforge/rapier3d-compat');await R.init();const world=new R.World({x:0,y:0,z:0});addHomeTerrainSolids(R,world);
  const driver=createHomeCapsule(R,world,()=>2.4);h.ready=true;h.module.resolve();h.seed.mockImplementation(driver.seed);h.step.mockImplementation(driver.step);
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const l=input('left'),r=input('right'),session=visit([l,r]),root=createRoot(document.createElement('div')),scene=new Scene(),origin=new Group(),head=new Group();origin.add(head);
  head.position.set(.12,1.67,-.16);const eyes=[new Group(),new Group()];eyes.forEach((e,i)=>{e.position.x=i?.032:-.032;head.add(e);});
  const tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/60,{session,getViewerPose:()=>({transform:{position:head.position,orientation:head.quaternion}})});
  const foot=()=>new Vector3(head.position.x,0,head.position.z).applyMatrix4(origin.matrixWorld),up=new Vector3(0,1,0),axis=(v:number)=>v===0?0:Math.sign(v)*.16+.84*v;
  const stagedUp=()=>up.clone().applyQuaternion(origin.quaternion),radial=(p:Vector3)=>p.clone().sub(homeWorld.centre).normalize();
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();let south=1;
    for(let i=0;i<1100;i++){
      const yaw=.9*Math.sin(i/92);head.rotation.set(.3*Math.sin(i/56),yaw,.35*Math.sin(i/65),'YXZ');
      l.gamepad.axes[2]=axis(Math.sin(yaw));l.gamepad.axes[3]=-axis(Math.cos(yaw));tick();
      const n=radial(foot());south=Math.min(south,n.y);expect(stagedUp().angleTo(n)).toBeLessThan(1e-6);
      for(const e of eyes){const eyeQ=e.getWorldQuaternion(new Quaternion());expect(n.angleTo(up.clone().applyQuaternion(eyeQ))).toBeCloseTo(up.angleTo(up.clone().applyQuaternion(head.quaternion)),6);}
    }
    expect(south).toBeLessThan(-.999);expect(samplePlanetMovement()!.groundedWalkM).toBeGreaterThan(43);
    expect(samplePlanetMovement()).toMatchObject({backend:'rapier',grounded:true,orbitalJumps:0});
    // No previous hop, hence no groundTilt to clear. Y must still be able to
    // stand a visitor who physically moved away from the motor's old sole.
    l.gamepad.axes.fill(0);tick();const beforeStep=origin.quaternion.clone();head.position.x+=.34;tick();
    const here=radial(foot());expect(origin.quaternion.angleTo(beforeStep)).toBeLessThan(1e-7);expect(stagedUp().angleTo(here)).toBeGreaterThan(.02);
    l.gamepad.buttons[5].pressed=true;tick();expect(stagedUp().angleTo(here)).toBeLessThan(1e-6);
    expect(samplePlanetMovement()).toMatchObject({alignments:1,orbitalJumps:0});l.gamepad.buttons[5].pressed=false;tick();
    head.rotation.set(.22,.45,-.31,'YXZ');l.gamepad.axes[2]=0;l.gamepad.axes[3]=-1;r.gamepad.buttons[4].pressed=true;
    tick();expect(samplePlanetMovement()?.location).toBe('orbit');
    for(let i=0;i<300&&samplePlanetMovement()?.location==='orbit';i++){const before=origin.quaternion.clone();tick();expect(origin.quaternion.angleTo(before)).toBeLessThan(.012);}
    expect(samplePlanetMovement()).toMatchObject({location:'home',grounded:true,orbitalLandings:1,alignments:1});
    l.gamepad.axes[3]=0;r.gamepad.buttons[4].pressed=false;tick();const rest=origin.matrixWorld.clone(),at=foot();
    expect(stagedUp().angleTo(radial(at))).toBeLessThan(.001);
    const nav=origin.quaternion.clone().premultiply(new Quaternion().setFromUnitVectors(stagedUp(),radial(at)));
    // A real 28 cm reposition onto the uphill side used to put the candidate
    // ankle below the triangulated crust, making Y a no-op in the open.
    const delta=Array.from({length:16},(_,k)=>new Vector3(.28*Math.cos(k*Math.PI/8),0,.28*Math.sin(k*Math.PI/8)))
      .sort((a,b)=>altitude(homeWorld,at.clone().add(a.clone().applyQuaternion(nav)))-altitude(homeWorld,at.clone().add(b.clone().applyQuaternion(nav))))[0];
    expect(altitude(homeWorld,at.clone().add(delta.clone().applyQuaternion(nav)))).toBeLessThan(-.002);
    const n=radial(at.clone().add(delta.clone().applyQuaternion(origin.quaternion)));
    head.position.add(delta);tick();expect(Math.max(...origin.matrixWorld.elements.map((v,i)=>Math.abs(v-rest.elements[i])))).toBeLessThan(1e-8);expect(stagedUp().angleTo(n)).toBeGreaterThan(.015);
    l.gamepad.buttons[5].pressed=true;tick();expect(samplePlanetMovement()?.alignments).toBe(2);
    expect(altitude(homeWorld,foot())).toBeCloseTo(0,5);expect(stagedUp().angleTo(n)).toBeLessThan(1e-6);
    expect(eyes[0].getWorldPosition(new Vector3()).distanceTo(eyes[1].getWorldPosition(new Vector3()))).toBeCloseTo(.064,7);
    expect(eyes[1].getWorldQuaternion(new Quaternion()).angleTo(origin.quaternion.clone().multiply(head.quaternion))).toBeLessThan(1e-6);
    const level=origin.matrixWorld.clone();for(let i=0;i<30;i++)tick();expect(Math.max(...origin.matrixWorld.elements.map((v,i)=>Math.abs(v-level.elements[i])))).toBeLessThan(1e-8);
    l.gamepad.axes[3]=-1;for(let i=0;i<100;i++){tick();expect(stagedUp().angleTo(radial(foot()))).toBeLessThan(1e-6);}
    expect(samplePlanetMovement()).toMatchObject({grounded:true,alignments:2,orbitalJumps:1});
  }finally{await act(async()=>root.unmount());driver.dispose();world.free();h.seed.mockReset();h.step.mockReset();useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it('re-entry, session replacement and frameless visibility / device changes require observed neutral input',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState(),root=createRoot(document.createElement('div'));
  useMmdVrStore.setState({prefs:{...old.prefs,movementMode:'normal',normalEyeOffset:0}});
  h.module.resolve();h.ready=false;
  const origin=new Group(),scene=new Scene(),xr={getReferenceSpace:()=>({})};
  const controller=()=>({handedness:'right',targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,1,0],buttons:Array.from({length:5},()=>({pressed:true}))}});
  const change=(session:EventTarget,removed:unknown[],added:unknown[])=>session.dispatchEvent(Object.assign(new Event('inputsourceschange'),{added,removed}));
  const tick=(session:EventTarget)=>h.frame!({gl:{xr},scene},1/90,{session,getViewerPose:()=>({transform:{position:new Vector3(0,1.65,0),orientation:new Quaternion()}})});
  const report=()=>samplePlanetMovement()!;
  try{
    for(let entry=0;entry<2;entry++){
      const key='visit'+entry,mount=()=>act(async()=>root.render(<PlanetMotor key={key} originRef={{current:origin}} dragging={false}/>));
      let r=controller();let session=visit([r]);await mount();
      const input=(x:number,a:boolean)=>{r.gamepad.axes[2]=x;if(r.gamepad.buttons[4])r.gamepad.buttons[4].pressed=a;};
      const idle=()=>expect(report()).toMatchObject({snapTurns:0,orbitalJumps:0,location:'home'});
      tick(session);idle();input(0,false);tick(session);
      // No hidden or missing-pose frame whatsoever. The event expires the edge.
      session.visibilityState='hidden';session.dispatchEvent(new Event('visibilitychange'));
      input(1,true);session.visibilityState='visible';session.dispatchEvent(new Event('visibilitychange'));tick(session);idle();
      input(0,false);tick(session);const disconnected=r;session.inputSources=[];change(session,[disconnected],[]);
      tick(session);tick(session);r=controller();session.inputSources=[r];change(session,[],[r]);tick(session);idle();
      // Both replacement events between two visible frames, while previously
      // neutral. A present stick with no button binding is not an A release.
      input(0,false);tick(session);const previous=r;r=controller();r.gamepad.buttons=[];
      session.inputSources=[r];change(session,[previous],[r]);tick(session);r.gamepad.buttons=controller().gamepad.buttons;tick(session);idle();
      input(0,false);tick(session);const retired=session;r=controller();session=visit([r]);await mount();
      tick(retired);tick(session);idle();
      // A retired session can neither arm nor disarm the active visit.
      input(0,false);tick(session);retired.dispatchEvent(new Event('visibilitychange'));input(1,true);tick(session);tick(session);
      expect(report()).toMatchObject({snapTurns:1,orbitalJumps:1,location:'orbit'});
    }
  }finally{await act(async()=>root.unmount());h.ready=true;useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it('checks a 6 cm roof over the actual offset eye for calibration and A; moving the headset stays 1:1',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState(),bag=useBackpack.getState();
  const setHeight=(normalEyeOffset:number)=>useMmdVrStore.setState({prefs:{...old.prefs,movementMode:'normal',normalEyeOffset}});
  setHeight(0);h.module.resolve();h.ready=false;
  const origin=new Group(),scene=new Scene(),root=createRoot(document.createElement('div'));
  const r={handedness:'right',targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:5},()=>({pressed:false}))}};
  const session=visit([r]),p=new Vector3(0,1.65,0),orient=new Quaternion(),xr={getReferenceSpace:()=>({})};
  const tick=()=>h.frame!({gl:{xr},scene},1/90,{session,getViewerPose:()=>({transform:{position:p,orientation:orient}})});
  const eye=()=>p.clone().applyMatrix4(origin.matrixWorld),roof=new Mesh(new BoxGeometry(.20,.06,.46),new MeshBasicMaterial());
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();p.x+=.50;tick();
    const base=eye(),bottom=base.y+.21;roof.position.copy(base);roof.position.y=bottom+.03;roof.userData.stagePropSolid=true;scene.add(roof);
    useBackpack.setState({live:{...bag.live}});setHeight(.1);tick();setHeight(.2);tick();
    expect(eye().y).toBeLessThanOrEqual(bottom-.115+1e-6);expect(eye().y-base.y).toBeGreaterThan(.05);
    const admitted=eye(),fixed=origin.matrixWorld.clone(),lean=new Vector3(.03,.16,.02);p.add(lean);tick();
    expect(Math.max(...origin.matrixWorld.elements.map((v,i)=>Math.abs(v-fixed.elements[i])))).toBeLessThan(1e-8);
    expect(eye().sub(admitted).distanceTo(lean.clone().applyQuaternion(origin.quaternion))).toBeLessThan(1e-8);
    p.sub(lean);tick();setHeight(0);tick();expect(eye().distanceTo(base)).toBeLessThan(1e-7);
    const jump=()=>{const start=eye().y;let peak=start,inside=0;r.gamepad.buttons[4].pressed=true;
      for(let i=0;i<200;i++){tick();const h=eye().y;peak=Math.max(peak,h);if(h>=bottom&&h<=bottom+.06)inside++;}
      r.gamepad.buttons[4].pressed=false;tick();return {rise:peak-start,inside};};
    const capped=jump();expect(capped.inside).toBe(0);expect(capped.rise).toBeGreaterThan(.025);expect(capped.rise).toBeLessThan(.12);
    p.x+=.75;tick();expect(jump().rise).toBeGreaterThan(.5);expect(samplePlanetMovement()).toMatchObject({orbitalJumps:2,orbitalLandings:2});
  }finally{await act(async()=>root.unmount());roof.geometry.dispose();roof.material.dispose();h.ready=true;useMmdVrStore.setState(old);useBackpack.setState(bag);vi.unstubAllGlobals();}
});
