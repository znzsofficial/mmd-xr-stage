// @vitest-environment jsdom
import {act,useLayoutEffect,type RefObject} from 'react';
import {createRoot} from 'react-dom/client';
import {Group,Quaternion,Scene,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {useMmdVrStore} from '../mmdVrStore';
import {lanes,rideStep,startRide} from '../scenery/planet/windAtlas';
import {WALK_SPEED} from '../mmdVrQuality';
import {leapRoutes,twinPad} from '../scenery/planet/leapAtlas';
import {altitude,shellRadius} from './orbitalSurfaces';
import {jumpVelocity,startOrbit,stepOrbit} from './orbitalFlight';
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

it.each(['recall','other wind','unmarked'] as const)('X/A/Y and stick axes: round trip, tracking loss, free, then hand back to mother via %s',async exit=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  h.ready=false;h.seed.mockClear();h.step.mockClear();h.stop.mockClear();
  const old=useMmdVrStore.getState();useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:'normal',normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],
     gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const left=input('left'),right=input('right'),axes=left.gamepad.axes,x=left.gamepad.buttons[4],a=right.gamepad.buttons[4];
  const p={x:.17,y:1.65,z:-.21},pose={transform:{position:p,orientation:new Quaternion()}};let tracked=true;
  const dt=1/90,session={visibilityState:'visible',inputSources:[left,right]},xr={getReferenceSpace:()=>({})};
  const tick=(count=1)=>{for(let i=0;i<count;i++)h.frame!({gl:{xr},scene},dt,{session,getViewerPose:()=>tracked?pose:null});};
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld),up=()=>new Vector3(0,1,0).applyQuaternion(origin.quaternion);
  const report=()=>samplePlanetMovement()!,lane=lanes.find(l=>l.moon.id==='salt')!,pad=twinPad(lane.moon)!;
  const turnHead=(angle:number)=>pose.transform.orientation.setFromAxisAngle(new Vector3(0,1,0),angle);
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
    const approach=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());p.x+=approach.x;p.z+=approach.z;
    // This first jump landed on the real tracked sole in the collar. Y aligns
    // its tangent explicitly before exercising the two directed routes.
    left.gamepad.buttons[5].pressed=true;tick();left.gamepad.buttons[5].pressed=false;tick(3);
    const begin=foot(),startBasis=origin.quaternion.clone(),last=up(),normal=new Vector3(),sample=new Vector3(),ride=startRide(lane,false,begin,last),swing=new Quaternion();
    x.pressed=true;
    for(let i=0;i<1000;i++){turnHead(Math.sin(i/160)*1.1);tick();const done=rideStep(ride,dt,sample,normal);startBasis.premultiply(swing.setFromUnitVectors(last,normal)).normalize();last.copy(normal);
      expect(origin.quaternion.angleTo(startBasis)).toBeLessThan(1e-6);expect(foot().distanceTo(sample)).toBeLessThan(1e-5);if(done)break;}
    turnHead(0);expect(report().location).toBe('salt');expect(up().distanceTo(lane.away.up)).toBeLessThan(1e-6);x.pressed=false;tick();
    // At the north wind collar this is a normal radial jump under salt's 1.25 m/s².
    const launch=foot();a.pressed=true;tick();x.pressed=true;tick(89);expect(foot().y-launch.y).toBeCloseTo(1.6-.625,5);tick(160);
    expect(report()).toMatchObject({location:'salt',windDepartures:1});x.pressed=a.pressed=false;tick();
    expect(report().twinDepartures).toBe(0);
    if(exit==='unmarked'){
      for(const [from,to] of [['salt','glaze'],['glaze','salt']]){
        const m=lanes.find(l=>l.moon.id===from)!.moon,other=lanes.find(l=>l.moon.id===to)!.moon;
        const axis=other.centre.clone().sub(m.centre).normalize();
        const n=axis.clone().multiplyScalar(Math.cos(.30)).addScaledVector(new Vector3(0,1,0),Math.sin(.30));
        const at=m.centre.clone().addScaledVector(n,shellRadius(m,n.x,n.y,n.z));
        walkTo(at);const stick=axis.projectOnPlane(up()).normalize().applyQuaternion(origin.quaternion.clone().invert());
        const map=(v:number)=>v===0?0:Math.sign(v)*.16+.84*v;
        axes[2]=map(stick.x);axes[3]=map(stick.z);const before=origin.quaternion.clone(),captures=report().orbitalLandings;
        const atLaunch=foot(),launchNormal=atLaunch.clone().sub(m.centre).normalize(),flight=startOrbit(m,atLaunch,jumpVelocity(m,launchNormal,stick.clone().applyQuaternion(before),2.4,new Vector3()));
        const eyeOffset=up().multiplyScalar(p.y),expected=flight.foot.clone();a.pressed=true;h.ready=true;
        for(let i=0;i<400;i++){if(i===1){axes[2]=axes[3]=0;turnHead(1.1);}tick();const done=stepOrbit(flight,dt,new Vector3(0,1,0).applyQuaternion(before),eyeOffset);
          expect(origin.quaternion.angleTo(before)).toBeLessThan(1e-6);expect(foot().distanceTo(expected.copy(flight.foot))).toBeLessThan(.002);
          expect(altitude(other,foot().add(eyeOffset))).toBeGreaterThan(.10);if(done)break;}
        expect(report()).toMatchObject({location:to,gravityOwner:to,grounded:true,twinDepartures:0,orbitalLandings:captures+1});
        expect(origin.quaternion.angleTo(before)).toBeLessThan(1e-6);expect(h.seed).not.toHaveBeenCalled();
        const socket=origin.worldToLocal(flight.point.clone()),prior=flight.up.clone(),walked=report().groundedWalkM;axes[2]=1;
        for(let i=0;i<21;i++){const basis=origin.quaternion.clone();tick();const support=origin.localToWorld(socket.clone()),radial=support.clone().sub(other.centre).normalize();
          expect(altitude(other,support)).toBeCloseTo(0,3);expect(origin.quaternion.angleTo(basis.premultiply(swing.setFromUnitVectors(prior,radial)))).toBeLessThan(1e-4);prior.copy(radial);
          expect(altitude(other,foot().addScaledVector(up(),p.y))).toBeGreaterThan(.09);}
        axes[2]=0;expect(report().groundedWalkM-walked).toBeGreaterThan(.51);const parked=foot();tick(90);expect(foot().distanceTo(parked)).toBeLessThan(1e-8);
        // Y, and only Y, explicitly stands the displayed posture on the new moon.
        a.pressed=false;turnHead(0);left.gamepad.buttons[5].pressed=true;tick();left.gamepad.buttons[5].pressed=false;tick();
        expect(up().dot(foot().sub(other.centre).normalize())).toBeGreaterThan(.9999);
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
      if(i===63){drift.set(.08,0,.11);p.x+=drift.x;p.z+=drift.z;}
      tick();done=stepTwinLeap(leap,dt,expectedFoot,expectedUp);qExpected.premultiply(rot.setFromUnitVectors(lastUp,expectedUp)).normalize();lastUp.copy(expectedUp);
      turnHead(Math.sin(i/80));expect(origin.quaternion.angleTo(qExpected)).toBeLessThan(1e-6);
      expect(foot().distanceTo(drift.clone().applyQuaternion(qExpected).add(expectedFoot))).toBeLessThan(1e-6);
      if(report().location==='twinLeap'&&report().gravityOwner==='glaze')seenSeam=true;
    }
    expect(done&&seenSeam).toBe(true);expect(report()).toMatchObject({location:'glaze',gravityOwner:'glaze',twinDepartures:1,twinLandings:1});
    const beforeLean=foot(),extra=.075;p.x+=extra;tick();expect(foot().sub(beforeLean).distanceTo(new Vector3(extra,0,0).applyQuaternion(qExpected))).toBeLessThan(1e-7);p.x-=extra;
    turnHead(0);expect(origin.quaternion.angleTo(qExpected)).toBeLessThan(1e-6);tick(180);
    expect(h.stop).toHaveBeenCalledOnce();expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
    a.pressed=false;tick();a.pressed=true;tick();const back=origin.quaternion.clone();for(let i=0;i<500&&report().location==='twinLeap';i++){const prior=origin.quaternion.clone();tick();expect(prior.angleTo(origin.quaternion)).toBeLessThan(.018);}
    expect(back.angleTo(origin.quaternion)).toBeGreaterThan(2.9);expect(report()).toMatchObject({location:'salt',twinDepartures:2,twinLandings:2});
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
        tick(400);const otherLane=lanes.find(l=>l.moon.id==='glaze')!;
      for(const [from,to] of [['glaze','mica'],['mica','sulfur'],['sulfur','mica'],['mica','glaze']]){
        const crossing=leapRoutes.find(r=>r.pad.id===from&&r.target.id===to)!;
        a.pressed=false;tick();walkTo(crossing.pad.foot);
          a.pressed=true;tick(400);expect(report()).toMatchObject({location:to,gravityOwner:to});
        expect(foot().distanceTo(crossing.target.foot)).toBeLessThan(.03);
      }
      expect(h.seed).not.toHaveBeenCalled();expect(h.step).not.toHaveBeenCalled();
      a.pressed=false;tick();walkTo(otherLane.away.foot);
      x.pressed=true;tick();expect(report().location).toBe('wind');for(let i=0;i<1100&&report().location==='wind';i++)tick();
        expect(h.seed).not.toHaveBeenCalled();tick();
      expect(report()).toMatchObject({location:'home',gravityOwner:'home',windLandings:2,twinDepartures:8,twinLandings:7});
      expect(foot().distanceTo(otherLane.home.foot)).toBeLessThan(.001);
    }
    expect(h.seed).toHaveBeenCalledOnce();const steps=h.step.mock.calls.length;tick();expect(h.step).toHaveBeenCalledTimes(steps+1);
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});

it.each(['slow','normal','fast','sprint'] as const)('%s: lantern dry ground resumes the same stick speed on the first frame after a held-A hop',async tier=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'glassPlanet',movementMode:'normal',walkSpeedPref:tier,normalEyeOffset:0}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene(),dt=1/90,lane=lanes.find(l=>l.moon.id==='lantern')!;
  const input=(hand:string)=>({handedness:hand,targetRayMode:'tracked-pointer',profiles:['meta-quest-touch-plus'],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
  const l=input('left'),r=input('right'),p=new Vector3(0,1.63,0),report=()=>samplePlanetMovement()!;
  const tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},dt,{session:{visibilityState:'visible',inputSources:[l,r]},getViewerPose:()=>({transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}})});
  const foot=()=>new Vector3(p.x,0,p.z).applyMatrix4(origin.matrixWorld),measure=()=>{const before=foot();tick();return foot().distanceTo(before)/dt;};
  h.ready=false;
  try{
    await act(async()=>root.render(<PlanetMotor originRef={{current:origin}} dragging={false}/>));tick();
    for(let i=0;i<800&&foot().distanceTo(lane.home.foot)>.35;i++){
      const d=lane.home.foot.clone().sub(foot()).applyQuaternion(origin.quaternion.clone().invert());
      const norm=Math.hypot(d.x,d.z);l.gamepad.axes[2]=.16*Math.sign(d.x)+.84*d.x/norm;l.gamepad.axes[3]=.16*Math.sign(d.z)+.84*d.z/norm;tick();
    }
    l.gamepad.axes[2]=l.gamepad.axes[3]=0;tick();expect(foot().distanceTo(lane.home.foot)).toBeLessThan(.35);
    l.gamepad.buttons[4].pressed=true;tick();expect(report().location).toBe('wind');for(let i=0;i<1100&&report().location==='wind';i++)tick();
    expect(report().location).toBe('lantern');l.gamepad.buttons[4].pressed=false;l.gamepad.axes[3]=-.8;
    const control=measure();expect(control).toBeCloseTo(WALK_SPEED[tier]*(.8-.16)/.84,1);
    r.gamepad.buttons[4].pressed=true;tick();expect(report().location).toBe('orbit');
    for(let i=0;i<600&&report().location==='orbit';i++)tick();
    expect(report()).toMatchObject({location:'lantern',grounded:true,orbitalLandings:1});
    const first=measure(),before=report().groundedWalkM;for(let i=0;i<12;i++)tick();
    const speed=(report().groundedWalkM-before)/(12*dt);expect(speed/control).toBeGreaterThan(.91);expect(speed/control).toBeLessThan(1.15);
    expect(first/control).toBeGreaterThan(.96);
    for(let i=0;i<9;i++)tick();expect(measure()/control).toBeGreaterThan(.96);
    expect(report()).toMatchObject({location:'lantern',orbitalJumps:1,orbitalLandings:1,alignments:0});
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);vi.unstubAllGlobals();}
});
