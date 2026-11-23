// @vitest-environment jsdom
import {act,useLayoutEffect,type RefObject} from 'react';
import {createRoot} from 'react-dom/client';
import {Group,Quaternion,Scene,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {useMmdVrStore} from '../mmdVrStore';
import {lanes} from '../scenery/planet/windAtlas';
import {leapRoutes,twinPad} from '../scenery/planet/leapAtlas';
import {shellRadius} from './orbitalSurfaces';
import PlanetMotor from './PlanetMotor';
import {samplePlanetMovement} from './planetDiagnostics';
import {startTwinLeap,stepTwinLeap} from './twinLeap';
import type {PlanetDriver} from './planetTravel';

const h=vi.hoisted(()=>({frame:null as Function|null,ready:false,seed:vi.fn(),step:vi.fn(),stop:vi.fn()}));
vi.mock('@react-three/fiber',()=>({useFrame:(cb:Function)=>{h.frame=cb;}}));
vi.mock('@react-three/xr',()=>({useXRInputSourceState:()=>undefined}));
vi.mock('./PlanetPhysics',()=>({default:({driver}:{driver:RefObject<PlanetDriver|null>})=>{
  useLayoutEffect(()=>{driver.current={ready:()=>h.ready,seed:h.seed,step:h.step,stop:h.stop};
    return()=>{driver.current=null;};},[driver]);return null;}}));

it.each(['recall','other wind','unmarked','unmarked auto'] as const)('X/A/Y and stick axes: round trip, tracking loss, free, then hand back to mother via %s',async exit=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  h.ready=false;h.seed.mockClear();h.step.mockClear();h.stop.mockClear();
  const auto=exit==='unmarked auto',old=useMmdVrStore.getState();useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0,planetAutoLanding:auto}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],
     gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const left=input('left'),right=input('right'),axes=left.gamepad.axes,x=left.gamepad.buttons[4],a=right.gamepad.buttons[4],y=left.gamepad.buttons[5];
  const p={x:.17,y:1.65,z:-.21},pose={transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}};let tracked=true;
  const dt=1/90,session={visibilityState:'visible',inputSources:[left,right]},xr={getReferenceSpace:()=>({})};
  const tick=(count=1)=>{for(let i=0;i<count;i++)h.frame!({gl:{xr},scene},dt,{session,getViewerPose:()=>tracked?pose:null});};
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld),up=()=>new Vector3(0,1,0).applyQuaternion(origin.quaternion);
  const report=()=>samplePlanetMovement()!,lane=lanes.find(l=>l.moon.id==='salt')!,pad=twinPad(lane.moon)!;
  const align=()=>{if(report().awaitingAlignment){
    if(auto){for(let i=0;i<1000&&report().awaitingAlignment;i++){const prev=origin.quaternion.clone();tick();expect(origin.quaternion.angleTo(prev)).toBeLessThan(dt*.88);}
      expect(report().awaitingAlignment).toBe(false);}
    else{y.pressed=false;tick();y.pressed=true;tick();y.pressed=false;}
  }};
  const walkTo=(target:Vector3)=>{
    const axis=(value:number)=>value===0?0:Math.sign(value)*.16+.84*value;
    for(let i=0;i<500&&foot().distanceTo(target)>.05;i++){
      const d=target.clone().sub(foot()).projectOnPlane(up()).normalize().applyQuaternion(origin.quaternion.clone().invert());
      axes[2]=axis(d.x);axes[3]=axis(d.z);tick();
    }
    axes[2]=axes[3]=0;tick();expect(foot().distanceTo(target)).toBeLessThan(.05);
  };
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    const walkIn=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());p.x+=walkIn.x;p.z+=walkIn.z;
    // X pressed just after jumping (still within collar range) is consumed
    // here, not queued for the frame when the mother surface supports us.
    a.pressed=true;tick();x.pressed=true;tick(210);expect(report()).toMatchObject({location:'home',windDepartures:0});
    x.pressed=a.pressed=false;tick();
    align();const approach=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());p.x+=approach.x;p.z+=approach.z;
    tick(3);x.pressed=true;tick();expect(report().location).toBe('wind');tick(1000);x.pressed=false;tick();align();expect(report().location).toBe('salt');
    // At the north wind collar this is a normal radial jump under salt's 1.25 m/s².
    const launch=foot();a.pressed=true;tick();x.pressed=true;tick(89);expect(foot().y-launch.y).toBeCloseTo(1.6-.625,5);tick(160);
    expect(report()).toMatchObject({location:'salt',windDepartures:1});x.pressed=a.pressed=false;tick();
    expect(report().twinDepartures).toBe(0);
    if(exit==='unmarked'||auto){
      for(const [from,to] of [['salt','glaze'],['glaze','salt']]){
        const m=lanes.find(l=>l.moon.id===from)!.moon,other=lanes.find(l=>l.moon.id===to)!.moon;
        const axis=other.centre.clone().sub(m.centre).normalize();
        const n=axis.clone().multiplyScalar(Math.cos(.30)).addScaledVector(new Vector3(0,1,0),Math.sin(.30));
        const at=m.centre.clone().addScaledVector(n,shellRadius(m,n.x,n.y,n.z));
        walkTo(at);const stick=axis.projectOnPlane(up()).normalize().applyQuaternion(origin.quaternion.clone().invert());
        const map=(v:number)=>v===0?0:Math.sign(v)*.16+.84*v;
        axes[2]=map(stick.x);axes[3]=map(stick.z);const before=origin.quaternion.clone(),captures=report().orbitalLandings;
        a.pressed=true;y.pressed=true;tick();axes[2]=axes[3]=0;
        expect(report().location).toBe('orbit');h.ready=true;for(let i=0;i<400&&report().location==='orbit';i++)tick();
        expect(report()).toMatchObject({location:to,gravityOwner:to,awaitingAlignment:true,twinDepartures:0,orbitalLandings:captures+1});
        expect(origin.quaternion.angleTo(before)).toBeLessThan(1e-6);expect(h.seed).not.toHaveBeenCalled();
        align();expect(report().awaitingAlignment).toBe(false);expect(up().dot(foot().sub(other.centre).normalize())).toBeGreaterThan(.9999);
        a.pressed=false;tick();
      }
      useMmdVrStore.setState({viewEpoch:useMmdVrStore.getState().viewEpoch+1});tick();expect(h.seed).toHaveBeenCalledOnce();return;
    }
    walkTo(pad.foot);
    // Snap on the pad; that chosen heading must survive the handover. Rebase
    // a real tracked offset on departure, then move the headset again in air.
    right.gamepad.axes[2]=1;tick();right.gamepad.axes[2]=0;tick();p.x+=.11;p.z-=.07;
    const q0=origin.quaternion.clone(),initialUp=up(),actual=foot(),leap=startTwinLeap(lane.moon,actual,initialUp)!;
    const expectedFoot=new Vector3(),expectedUp=initialUp.clone(),lastUp=initialUp.clone(),qExpected=q0.clone(),rot=new Quaternion();
    const drift=new Vector3();let done=false,seenSeam=false;
    a.pressed=true;
    for(let i=0;i<800&&!done;i++){
      if(i===45){h.ready=true;tracked=false;const frozen=origin.matrixWorld.clone();tick(180);expect(origin.matrixWorld.equals(frozen)).toBe(true);tracked=true;}
      if(i===63){drift.set(.08,0,.11);p.x+=drift.x;p.z+=drift.z;y.pressed=true;}
      tick();done=stepTwinLeap(leap,dt,expectedFoot,expectedUp);qExpected.premultiply(rot.setFromUnitVectors(lastUp,expectedUp)).normalize();lastUp.copy(expectedUp);
      expect(origin.quaternion.angleTo(q0)).toBeLessThan(1e-6);
      expect(foot().distanceTo(drift.clone().applyQuaternion(q0).add(expectedFoot).addScaledVector(expectedUp,p.y).addScaledVector(initialUp,-p.y))).toBeLessThan(1e-6);
      if(report().location==='twinLeap'&&report().gravityOwner==='glaze')seenSeam=true;
    }
    expect(done&&seenSeam).toBe(true);tick(180);expect(report()).toMatchObject({location:'glaze',gravityOwner:'glaze',twinDepartures:1,twinLandings:1});
    expect(report().awaitingAlignment).toBe(true);expect(origin.quaternion.angleTo(q0)).toBeLessThan(1e-6);
    align();expect(origin.quaternion.angleTo(qExpected)).toBeLessThan(1e-6);expect(report().awaitingAlignment).toBe(false);
    expect(h.stop).toHaveBeenCalledOnce();expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
    a.pressed=false;tick();a.pressed=true;tick(500);align();expect(report()).toMatchObject({location:'salt',twinDepartures:2,twinLandings:2});
    const homePad=foot();expect(homePad.distanceTo(pad.foot)).toBeLessThan(.03);
    a.pressed=false;tick();a.pressed=true;tick();
    for(let i=0;i<500&&report().gravityOwner==='salt';i++)tick();
    expect(report()).toMatchObject({location:'twinLeap',gravityOwner:'glaze'});
    const beforeFree=origin.matrixWorld.clone();useMmdVrStore.setState({prefs:{...useMmdVrStore.getState().prefs,movementMode:'free'}});tick();
    expect(origin.matrixWorld.equals(beforeFree)).toBe(true);expect(report()).toMatchObject({location:'free',gravityOwner:null});
    useMmdVrStore.setState({prefs:{...useMmdVrStore.getState().prefs,movementMode:'normal'}});tick(10);
    expect(foot().distanceTo(homePad)).toBeLessThan(.001);expect(report()).toMatchObject({location:'salt',twinDepartures:3,twinLandings:2});
    a.pressed=false;tick();a.pressed=true;tick(50);expect(report().location).toBe('twinLeap');
    expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
    if(exit==='recall'){
      useMmdVrStore.setState({viewEpoch:useMmdVrStore.getState().viewEpoch+1});tick();
      expect(report()).toMatchObject({location:'home',gravityOwner:'home',twinDepartures:4,twinLandings:2});
      expect(foot().distanceTo(new Vector3(0,0,1.9))).toBeLessThan(1e-8);
    }else{
       tick(400);align();const otherLane=lanes.find(l=>l.moon.id==='glaze')!;
      for(const [from,to] of [['glaze','mica'],['mica','sulfur'],['sulfur','mica'],['mica','glaze']]){
        const crossing=leapRoutes.find(r=>r.pad.id===from&&r.target.id===to)!;
        a.pressed=false;tick();walkTo(crossing.pad.foot);
         a.pressed=true;tick(400);align();expect(report()).toMatchObject({location:to,gravityOwner:to});
        expect(foot().distanceTo(crossing.target.foot)).toBeLessThan(.03);
      }
      expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
      a.pressed=false;tick();walkTo(otherLane.away.foot);
      x.pressed=true;tick();expect(report().location).toBe('wind');for(let i=0;i<1100&&report().location==='wind';i++)tick();
       expect(h.seed).not.toHaveBeenCalled();align();tick();
      expect(report()).toMatchObject({location:'home',gravityOwner:'home',windLandings:2,twinDepartures:8,twinLandings:7});
      expect(foot().distanceTo(otherLane.home.foot)).toBeLessThan(.001);
    }
    expect(h.seed).toHaveBeenCalledOnce();tick();expect(h.step).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});
