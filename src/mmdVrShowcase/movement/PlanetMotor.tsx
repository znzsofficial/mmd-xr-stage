import {Component,lazy,Suspense,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useXR,useXRInputSourceState} from '@react-three/xr';
import {Quaternion,Vector3,type Group} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {WALK_SPEED} from '../settings/mmdVrQuality';
import {newStick,readStick,stickAxis} from './controllerInput';
import {carryFrame,createTraveller,north,surfaceStep,transport,type PlanetDriver} from './planetTravel';
import {observePlanet,planetCounters} from './planetDiagnostics';
import {createPlanetPad} from './planetPad';
import {headMargin} from './eyeHeight';
import {departureAt,rideStep,startRide,type WalkMoon,type Ride} from '../scenery/planet/windAtlas';
import {moonWalk} from './moonWalk';
import {alignPlanetStance,carryHomeHop,fitPlanetLift,followHomeFootprint} from './planetStance';
import {interruptPlanetEdges,watchPlanetEdges} from './planetInputEdges';
import {tideWalkFactor} from '../scenery/planet/tideSession';
import {startTwinLeap,stepTwinLeap,type TwinLeap} from './twinLeap';
import {jumpVelocity,startOrbit,stepOrbit,type Orbit} from './orbitalFlight';
import {altitude,homeWorld,shellRadius} from './orbitalSurfaces';
import {seatOrbitContact} from './orbitContact';
import {useBackpack} from '../backpack/store';
import {observeStance,stanceProbe} from './stanceDiagnostics';

class PhysicsBoundary extends Component<{failed:()=>void;children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.failed();}
  render(){return this.state.failed?null:this.props.children;}
}
type Props={originRef:RefObject<Group|null>;dragging:boolean};
const noTilt=new Quaternion();

// One owner of the foot, heading, input edges and XR origin for the whole visit.
// Only the optional physics adapter may suspend, never the input/frame callback.
export default function PlanetMotor({originRef,dragging}:Props){
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const session=useXR(s=>s.session);
  const driver=useRef<PlanetDriver|null>(null);
  const [Physics]=useState(()=>lazy(()=>import('./PlanetPhysics')));
  const [s]=useState(()=>({...createTraveller(),l:newStick(),r:newStick(),offset:new Vector3(),tmp:new Vector3(),travel:new Vector3(),
    safe:new Vector3(),safeOffset:new Vector3(),freeStart:new Vector3(),prev:new Vector3(),localEye:new Vector3(),head:new Quaternion(),safeBasis:new Quaternion(),epoch:-1,free:false,snap:false,a:true,
    active:null as PlanetDriver|null,parked:null as PlanetDriver|null,diag:planetCounters(),pad:createPlanetPad(),lastLift:0,safeLift:0,eyeSetting:NaN,
    moon:null as WalkMoon|null,safeMoon:null as WalkMoon|null,ride:null as Ride|null,leap:null as TwinLeap|null,orbit:null as Orbit|null,
    xDown:false,yDown:false,windSupportFrames:2,worldEye:new Vector3(),stance:stanceProbe(),
    // Rigid transform from the navigation sole to the displayed tracking frame.
    // A head-first contact needs a translation as well as a relative tilt:
    // adopting the new physical sole must not teleport the eyes into the rock.
    seat:new Vector3(),safeSeat:new Vector3(),display:new Quaternion(),viewUp:new Vector3(),groundTilt:new Quaternion(),safeTilt:new Quaternion()}));
  useLayoutEffect(()=>{const unbind=observePlanet(s.diag);return()=>{unbind();s.pad.dispose();};},[s]);
  useLayoutEffect(()=>{s.stance.clearance=p=>altitude(s.orbit?.owner??s.moon??homeWorld,p);return observeStance(s.stance);},[s]);
  useLayoutEffect(()=>{if(session)return watchPlanetEdges(session,s);},[session,s]);
  useFrame(({gl,scene},elapsed,frame)=>{
    const origin=originRef.current,space=gl.xr.getReferenceSpace();if(!origin||!frame||frame.session!==session)return;
    const {prefs,viewEpoch}=useMmdVrStore.getState(),{diag}=s,d=driver.current;
    diag.frames++;readStick(frame.session.inputSources,'left',left,s.l);readStick(frame.session.inputSources,'right',right,s.r);
    diag.left=s.l.via;diag.right=s.r.via;
    if(Math.abs(s.l.x)>.16||Math.abs(s.l.y)>.16)diag.walkInputFrames++;
    if(Math.abs(s.r.x)>.65)diag.turnInputFrames++;
    if(dragging)diag.inputHeldFrames++;
    const pose=space&&(!frame.session.visibilityState||frame.session.visibilityState==='visible')&&frame.getViewerPose(space);
    const ready=d?.ready()?d:null;if(diag.backend!=='failed')diag.backend=ready?'rapier':'pending';
    if(!ready)s.parked=null;
    if(!pose){interruptPlanetEdges(s);if(s.active){if(s.active===ready)ready.stop();s.active=null;s.velocity.set(0,0,0);}return;}
    diag.poseFrames++;
    const {position:p,orientation:q}=pose.transform,free=prefs.movementMode==='free';
    const dt=Math.min(.05,Math.max(0,elapsed)),speed=WALK_SPEED[prefs.walkSpeedPref==='auto'?'normal':prefs.walkSpeedPref];
    const reset=s.epoch!==viewEpoch;
    if(reset){s.moon=s.safeMoon=null;s.ride=null;s.leap=null;s.orbit=null;s.xDown=s.l.primary;s.yDown=s.l.align;s.epoch=viewEpoch;s.up.copy(north);s.basis.identity();s.groundTilt.identity();s.safeTilt.identity();s.seat.set(0,0,0);s.safeSeat.set(0,0,0);s.offset.set(p.x,0,p.z);s.foot.set(0,0,1.9);transport(s);
      s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.grounded=true;s.velocity.set(0,0,0);s.active=null;s.a=s.r.primary;s.snap=false;s.free=false;s.windSupportFrames=2;s.lastLift=s.safeLift=0;s.eyeSetting=NaN;}
    if(free!==s.free){
       if(free){s.freeStart.set(p.x,0,p.z);s.ride=null;s.leap=null;s.orbit=null;s.basis.multiply(s.groundTilt);s.foot.add(s.seat.applyQuaternion(s.basis));s.seat.set(0,0,0);s.groundTilt.identity();s.up.copy(north).applyQuaternion(s.basis);if(!reset)s.foot.addScaledVector(s.up,s.lastLift);}
       else{s.stance.returns++;s.foot.copy(s.safe);s.basis.copy(s.safeBasis);s.groundTilt.copy(s.safeTilt);s.seat.copy(s.safeSeat);
         // Restore the supported stance even if the visitor walked around
         // their playspace while flying. Never rebase the tracked vertical.
         s.offset.set(p.x,0,p.z).sub(s.freeStart).add(s.safeOffset);s.up.copy(north).applyQuaternion(s.basis);s.moon=s.safeMoon;s.velocity.set(0,0,0);s.grounded=true;s.lastLift=s.safeLift;s.eyeSetting=NaN;}
       s.active=null;s.free=free;s.a=s.r.primary;s.xDown=s.l.primary;s.yDown=s.l.align;
    }
    if(s.r.via==='none')s.snap=false;else if(Math.abs(s.r.x)<.5&&Math.abs(s.r.y)<.5)s.snap=true;
    if(dragging)s.snap=false;
    if(Math.abs(s.r.x)>.65&&s.snap){const angle=-Math.sign(s.r.x)*prefs.snapTurnDegrees*Math.PI/180;s.snap=false;diag.snapTurns++;
      s.tmp.set(p.x,0,p.z).sub(s.offset).applyAxisAngle(north,-angle);s.offset.set(p.x,0,p.z).sub(s.tmp);
      s.seat.applyAxisAngle(north,-angle);
      s.basis.multiply(s.arc.setFromAxisAngle(north,angle));
      // Snap about the displayed vertical. Rebase tracking around the actual
      // visitor, including an offset contact, without translating either eye.
      if(!s.groundTilt.equals(noTilt))s.groundTilt.multiply(s.arc).premultiply(s.arc.invert());}
    s.display.multiplyQuaternions(s.basis,s.groundTilt);s.viewUp.copy(north).applyQuaternion(s.display);
    const x=dragging?0:stickAxis(s.l.x),forward=dragging?0:-stickAxis(s.l.y),jump=!dragging&&s.r.primary&&!s.a;s.a=s.r.primary||!s.r.primaryKnown;
    s.localEye.copy(p).sub(s.offset);
    const trackedStep=s.localEye.x*s.localEye.x+s.localEye.z*s.localEye.z>1e-12;
    const align=!free&&s.grounded&&(trackedStep||!s.groundTilt.equals(noTilt)||s.seat.lengthSq()>1e-10)&&!dragging&&s.l.align&&!s.yDown&&!useBackpack.getState().draft;
    s.yDown=s.l.align||!s.l.alignKnown;
    if(!free&&(!s.moon||s.orbit)&&!s.ride)s.pad.update(scene);
    if(align&&alignPlanetStance(s.moon??homeWorld,s,s.localEye,s.lastLift,s.pad.read)){
      if(trackedStep){s.offset.set(p.x,0,p.z);s.localEye.set(0,p.y,0);s.active=null;}
      diag.alignments++;s.eyeSetting=NaN;
    }
    s.dir.set(0,0,-1).applyQuaternion(s.head.set(q.x,q.y,q.z,q.w)).setY(0);if(s.dir.lengthSq()<1e-7)s.dir.set(0,0,-1);
    // Read the tracked yaw in the navigation tangent frame, also when looking
    // into an opposing shell. Projecting the old horizon may collapse an axis.
    s.dir.normalize().applyQuaternion(s.basis);
    s.travel.crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward).clampLength(0,1);
    s.localEye.add(s.seat);
    if(free)s.lastLift=0;
    else if(s.eyeSetting!==prefs.normalEyeOffset){
      s.eyeSetting=prefs.normalEyeOffset;
      s.lastLift=fitPlanetLift(s.orbit?s.orbit.owner:s.moon??homeWorld,s.foot,s.viewUp,s.worldEye.copy(s.localEye).applyQuaternion(s.display),p.y,s.lastLift,s.eyeSetting,s.pad.read);
    }
    const lift=s.lastLift;s.localEye.y+=lift;
    s.prev.copy(s.foot);
    // Require two supported frames and a fresh X; an airborne press is never a booking.
    s.windSupportFrames=!free&&!s.ride&&!s.leap&&!s.orbit&&!jump&&s.grounded?Math.min(2,s.windSupportFrames+1):0;
    if(!dragging&&s.windSupportFrames===2&&s.l.primary&&!s.xDown&&!useBackpack.getState().draft){
      // Account for the real room-scale offset when the visitor steps into
      // the collar. Rebase without a camera jump and land over the return pad.
      const actual=s.tmp.set(p.x-s.offset.x,0,p.z-s.offset.z).applyQuaternion(s.display).add(s.foot);
      const lane=departureAt(actual,s.moon);
      if(lane){s.foot.copy(actual);s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.ride=startRide(lane,!!s.moon,s.foot,s.up);s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=false;s.velocity.set(0,0,0);s.active=null;diag.windDepartures++;}
    }
    s.xDown=s.l.primary||!s.l.primaryKnown;
    if(s.moon&&jump&&s.grounded&&!s.ride&&!s.leap&&!free&&!useBackpack.getState().draft){
      const actual=s.tmp.set(p.x-s.offset.x,0,p.z-s.offset.z).applyQuaternion(s.display).add(s.foot);
      s.leap=startTwinLeap(s.moon,actual,s.up);
      if(s.leap){diag.twinDepartures++;s.safe.copy(s.leap.position);s.safeBasis.copy(s.basis);
        s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.grounded=false;}
    }
    if(!free&&!s.ride&&!s.leap&&!s.orbit){
      const world=s.moon??homeWorld;
      // Grounded is the measured foot support, not the suspension's last
      // shape cast. Leaving a ledge transfers once, as does a fresh A edge.
      if(!s.grounded||jump){s.orbit=startOrbit(world,s.foot,s.grounded?jumpVelocity(world,s.up,s.travel,speed,s.tmp):s.velocity);
        s.grounded=false;s.active=null;diag.orbitalJumps++;}
    }
    // The optional body can first become valid halfway between moons.
    if(ready&&(free||s.ride||s.moon||s.orbit)&&s.parked!==ready){ready.stop();s.parked=ready;}
    const groundFrame=!free&&!s.ride&&!s.leap&&!s.orbit;
    if(free){s.foot.addScaledVector(s.travel,speed*dt).addScaledVector(s.up,dragging?0:-stickAxis(s.r.y)*speed*dt);}
    else if(s.ride||s.leap){
      let done=false;
      if(s.leap){done=stepTwinLeap(s.leap,dragging?0:dt,s.foot,s.radial);s.moon=s.leap.owner;s.velocity.copy(s.leap.velocity);
        if(done){s.leap=null;diag.twinLandings++;}}
      else if(s.ride){const before=1-s.ride.time/s.ride.lane.duration;done=rideStep(s.ride,dragging?0:dt,s.foot,s.radial);
        // The chosen wind route ends upright even when a prior unassisted
        // landing kept a contact tilt/seat. Ease those out IN flight, leaving
        // tracked gaze and any intervening snap turn independent of the ride.
        if(done){s.groundTilt.identity();s.seat.set(0,0,0);}
        else if(!s.groundTilt.equals(noTilt)||s.seat.lengthSq()>0){
          const after=1-s.ride.time/s.ride.lane.duration,remaining=after*after*(3-2*after)/(before*before*(3-2*before));
          s.groundTilt.slerp(noTilt,1-remaining);s.seat.multiplyScalar(remaining);
        }
        if(done){s.moon=s.ride.returning?null:s.ride.lane.moon;s.ride=null;diag.windLandings++;}}
      carryFrame(s,s.radial);
      if(done){s.velocity.set(0,0,0);s.grounded=true;s.windSupportFrames=0;}
    }
    else if(s.orbit){
      const f=s.orbit,changes=f.changes,grazes=f.grazes;
      const done=stepOrbit(f,dt,s.viewUp,s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.pad.read,p.y+lift);
      diag.wellChanges+=f.changes-changes;diag.grazes+=f.grazes-grazes;
      s.foot.copy(f.foot);s.velocity.copy(f.velocity);
      if(f.from===homeWorld&&f.owner===homeWorld&&!f.changes&&s.groundTilt.equals(noTilt)&&s.seat.lengthSq()===0&&(!done||f.part!=='head')){
        const target=done?f.up:s.radial.subVectors(f.foot,homeWorld.centre).normalize();
        carryHomeHop(s,f.foot,target,s.tmp.copy(p).sub(s.offset),lift,dt,s.pad.read);
        s.display.copy(s.basis);s.viewUp.copy(s.up);s.worldEye.copy(s.localEye).applyQuaternion(s.display);
      }
      if(done&&f.landing){
        seatOrbitContact(s,f,f.landing,p,s.worldEye,p.y+lift);s.windSupportFrames=0;
        if(s.groundTilt.angleTo(noTilt)<1e-7)s.groundTilt.identity();
        diag.lastLanding={frame:diag.frames,part:f.part,tiltDeg:Math.round(s.viewUp.angleTo(f.up)*18000/Math.PI)/100,seatM:Math.round(s.seat.length()*1000)/1000};
        s.moon=f.landing.id==='home'?null:f.landing;s.orbit=null;diag.orbitalLandings++;
      }
    }
    else if(s.moon){
      const wade=s.moon.id==='tide'&&s.grounded&&s.travel.lengthSq()>0?tideWalkFactor(scene,s.foot):1;
      moonWalk(s.moon,s,s.travel,speed*wade,dt,false,shellRadius,s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.viewUp,p.y+lift);
    }
    else if(ready){
      if(s.active!==ready){ready.seed(s);s.active=ready;s.parked=null;} // no step or origin recompute from a stale spawn this frame
      else ready.step(s,dt,x,forward,s.tmp.copy(s.localEye).applyQuaternion(s.groundTilt),s.pad.read);
    }else{
      s.active=null;
      surfaceStep(s,s.travel,speed,dt,false,s.pad.read,Math.max(.24,p.y+lift+headMargin),s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.viewUp);
    }
    const stride=s.prev.distanceTo(s.foot);
    if(groundFrame&&!s.moon&&s.grounded&&s.travel.lengthSq()>0&&stride>0&&s.groundTilt.equals(noTilt)&&s.seat.lengthSq()===0&&
      (p.x-s.offset.x)**2+(p.z-s.offset.z)**2>.015**2&&followHomeFootprint(s,s.offset,p,lift,stride,s.pad.read))s.active?.seed(s);
    if(!free&&s.grounded){s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.safeTilt.copy(s.groundTilt);s.safeSeat.copy(s.seat);s.safeMoon=s.moon;s.safeLift=lift;}
    diag.grounded=!free&&s.grounded;
    if(groundFrame&&diag.grounded&&s.travel.lengthSq()>0)diag.groundedWalkM+=stride;
    diag.gravityOwner=free||s.ride?null:s.orbit?s.orbit.owner?.id??null:s.moon?.id??'home';
    diag.location=free?'free':s.ride?'wind':s.leap?'twinLeap':s.orbit?'orbit':s.moon?.id??'home';
    diag.footTravelM+=s.prev.distanceTo(s.foot);
    origin.quaternion.multiplyQuaternions(s.basis,s.groundTilt);origin.position.copy(s.foot).add(s.tmp.subVectors(s.seat,s.offset).applyQuaternion(origin.quaternion));
    if(!free)origin.position.addScaledVector(s.viewUp.copy(north).applyQuaternion(origin.quaternion),lift);
    origin.updateMatrixWorld(true);
    const probe=s.stance;probe.frame=frame;probe.mode=prefs.movementMode;probe.grounded=diag.grounded;probe.wanted=prefs.normalEyeOffset;probe.lift=lift;
    probe.foot.copy(s.foot);probe.navUp.copy(s.up);probe.centre=(s.orbit?.owner??s.moon??homeWorld).centre;probe.up.subVectors(s.foot,probe.centre).normalize();
  },-2);
  return <PhysicsBoundary failed={()=>{s.diag.backend='failed';}}><Suspense fallback={null}><Physics driver={driver}/></Suspense></PhysicsBoundary>;
}
