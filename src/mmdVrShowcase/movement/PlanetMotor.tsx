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
import {departureAt,rideStep,startRide} from '../scenery/planet/windAtlas';
import {moonWalk} from './moonWalk';
import {alignPlanetStance,carryLocalHop,fitPlanetLift,followFootprint} from './planetStance';
import {interruptPlanetEdges,watchPlanetEdges} from './planetInputEdges';
import {tideWalkFactor} from '../scenery/planet/tideSession';
import {startTwinLeap,stepTwinLeap} from './twinLeap';
import {startJump,startOrbit,stepOrbit} from './orbitalFlight';
import {altitude,homeWorld,shellRadius} from './orbitalSurfaces';
import {ground,landOrbit,publishPlanetView,viewWorld,type PlanetMode} from './planetJourney';
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
    safe:new Vector3(),safeOffset:new Vector3(),freeStart:new Vector3(),prev:new Vector3(),localEye:new Vector3(),head:new Quaternion(),safeBasis:new Quaternion(),epoch:-1,snap:false,a:true,
    active:null as PlanetDriver|null,parked:null as PlanetDriver|null,diag:planetCounters(),pad:createPlanetPad(),lastLift:0,safeLift:0,eyeSetting:NaN,
    mode:ground() as PlanetMode,safeGround:ground(),
    xDown:false,yDown:false,windSupportFrames:2,worldEye:new Vector3(),stance:stanceProbe(),
    // Rigid transform from the navigation sole to the displayed tracking frame.
    // A head-first contact needs a translation as well as a relative tilt:
    // adopting the new physical sole must not teleport the eyes into the rock.
    seat:new Vector3(),safeSeat:new Vector3(),display:new Quaternion(),viewUp:new Vector3(),groundTilt:new Quaternion(),safeTilt:new Quaternion()}));
  useLayoutEffect(()=>{const unbind=observePlanet(s.diag);return()=>{unbind();s.pad.dispose();};},[s]);
  useLayoutEffect(()=>{s.stance.clearance=p=>altitude(viewWorld(s.mode),p);return observeStance(s.stance);},[s]);
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
    if(reset){s.mode=s.safeGround=ground();s.xDown=s.l.primary;s.yDown=s.l.align;s.epoch=viewEpoch;s.up.copy(north);s.basis.identity();s.groundTilt.identity();s.safeTilt.identity();s.seat.set(0,0,0);s.safeSeat.set(0,0,0);s.offset.set(p.x,0,p.z);s.foot.set(0,0,1.9);transport(s);
      s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.grounded=true;s.velocity.set(0,0,0);s.active=null;s.a=s.r.primary;s.snap=false;s.windSupportFrames=2;s.lastLift=s.safeLift=0;s.eyeSetting=NaN;}
    if(free!==(s.mode.kind==='free')){
       if(free){s.mode={kind:'free',world:viewWorld(s.mode)};s.freeStart.set(p.x,0,p.z);s.basis.multiply(s.groundTilt);s.foot.add(s.seat.applyQuaternion(s.basis));s.seat.set(0,0,0);s.groundTilt.identity();s.up.copy(north).applyQuaternion(s.basis);if(!reset)s.foot.addScaledVector(s.up,s.lastLift);}
       else{s.stance.returns++;s.foot.copy(s.safe);s.basis.copy(s.safeBasis);s.groundTilt.copy(s.safeTilt);s.seat.copy(s.safeSeat);
         // Restore the supported stance even if the visitor walked around
         // their playspace while flying. Never rebase the tracked vertical.
         s.offset.set(p.x,0,p.z).sub(s.freeStart).add(s.safeOffset);s.up.copy(north).applyQuaternion(s.basis);s.mode=s.safeGround;s.velocity.set(0,0,0);s.grounded=true;s.lastLift=s.safeLift;s.eyeSetting=NaN;}
       s.active=null;s.a=s.r.primary;s.xDown=s.l.primary;s.yDown=s.l.align;
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
    if(s.mode.kind==='orbit'||s.mode.kind==='ground'&&s.mode.world===homeWorld)s.pad.update(scene);
    if(align&&s.mode.kind==='ground'&&alignPlanetStance(s.mode.world,s,s.localEye,s.lastLift,s.pad.read)){
      if(trackedStep){s.offset.set(p.x,0,p.z);s.localEye.set(0,p.y,0);s.active=null;}
      diag.alignments++;s.eyeSetting=NaN;s.mode=ground(s.mode.world);
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
      s.lastLift=fitPlanetLift(s.mode.kind==='orbit'?s.mode.flight.owner:viewWorld(s.mode),s.foot,s.viewUp,s.worldEye.copy(s.localEye).applyQuaternion(s.display),p.y,s.lastLift,s.eyeSetting,s.pad.read);
    }
    const lift=s.lastLift;s.localEye.y+=lift;
    s.prev.copy(s.foot);
    // Require two supported frames and a fresh X; an airborne press is never a booking.
    s.windSupportFrames=s.mode.kind==='ground'&&!jump&&s.grounded?Math.min(2,s.windSupportFrames+1):0;
    if(s.mode.kind==='ground'&&!dragging&&s.windSupportFrames===2&&s.l.primary&&!s.xDown&&!useBackpack.getState().draft){
      // Account for the real room-scale offset when the visitor steps into
      // the collar. Rebase without a camera jump and land over the return pad.
      const actual=s.tmp.set(p.x-s.offset.x,0,p.z-s.offset.z).applyQuaternion(s.display).add(s.foot);
      const moon=s.mode.world.id==='home'?null:s.mode.world,lane=departureAt(actual,moon);
      if(lane){s.foot.copy(actual);s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.mode={kind:'wind',ride:startRide(lane,!!moon,s.foot,s.up)};s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=false;s.velocity.set(0,0,0);s.active=null;diag.windDepartures++;}
    }
    s.xDown=s.l.primary||!s.l.primaryKnown;
    if(s.mode.kind==='ground'&&s.mode.world.id!=='home'&&jump&&s.grounded&&!useBackpack.getState().draft){
      const actual=s.tmp.set(p.x-s.offset.x,0,p.z-s.offset.z).applyQuaternion(s.display).add(s.foot);
      const leap=startTwinLeap(s.mode.world,actual,s.up);
      if(leap){s.mode={kind:'twinLeap',leap,landing:s.mode.landing};diag.twinDepartures++;s.safe.copy(leap.position);s.safeBasis.copy(s.basis);
        s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.grounded=false;}
    }
    if(s.mode.kind==='ground'){
      const world=s.mode.world;
      // Grounded is the measured foot support, not the suspension's last
      // shape cast. Leaving a ledge transfers once, as does a fresh A edge.
      if(!s.grounded||jump){s.mode={kind:'orbit',flight:s.grounded?startJump(world,s.foot,s.up,s.travel,speed):startOrbit(world,s.foot,s.velocity),landing:s.mode.landing};
        s.grounded=false;s.active=null;diag.orbitalJumps++;}
    }
    // The optional body can first become valid halfway between moons.
    const mode=s.mode;
    if(ready&&!(mode.kind==='ground'&&mode.world===homeWorld)&&s.parked!==ready){ready.stop();s.parked=ready;}
    if(mode.kind==='free'){s.foot.addScaledVector(s.travel,speed*dt).addScaledVector(s.up,dragging?0:-stickAxis(s.r.y)*speed*dt);}
    else if(mode.kind==='wind'||mode.kind==='twinLeap'){
      let done=false;
      if(mode.kind==='twinLeap'){done=stepTwinLeap(mode.leap,dragging?0:dt,s.foot,s.radial);s.velocity.copy(mode.leap.velocity);
        if(done){s.mode=ground(mode.leap.owner,mode.landing);diag.twinLandings++;}}
      else {const ride=mode.ride,before=1-ride.time/ride.lane.duration;done=rideStep(ride,dragging?0:dt,s.foot,s.radial);
        // The chosen wind route ends upright even when a prior unassisted
        // landing kept a contact tilt/seat. Ease those out IN flight, leaving
        // tracked gaze and any intervening snap turn independent of the ride.
        if(done){s.groundTilt.identity();s.seat.set(0,0,0);}
        else if(!s.groundTilt.equals(noTilt)||s.seat.lengthSq()>0){
          const after=1-ride.time/ride.lane.duration,remaining=after*after*(3-2*after)/(before*before*(3-2*before));
          s.groundTilt.slerp(noTilt,1-remaining);s.seat.multiplyScalar(remaining);
        }
        if(done){s.mode=ground(ride.returning?homeWorld:ride.lane.moon);diag.windLandings++;}}
      carryFrame(s,s.radial);
      if(done){s.velocity.set(0,0,0);s.grounded=true;s.windSupportFrames=0;}
    }
    else if(mode.kind==='orbit'){
      const f=mode.flight,changes=f.changes,grazes=f.grazes;
      const done=stepOrbit(f,dt,s.viewUp,s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.pad.read,p.y+lift,
        mode.landing==='upright'&&f.localHop?(next,h)=>{
          carryLocalHop(f.from,s,f.foot,next,s.localEye,s.pad.read,h);s.worldEye.copy(s.localEye).applyQuaternion(s.display);
        }:undefined);
      diag.wellChanges+=f.changes-changes;diag.grazes+=f.grazes-grazes;
      s.foot.copy(f.foot);s.velocity.copy(f.velocity);
      if(done&&f.landing){
        s.mode=landOrbit(s,mode,f.landing,p,s.worldEye,p.y+lift);s.windSupportFrames=0;
        if(s.groundTilt.angleTo(noTilt)<1e-7)s.groundTilt.identity();
        diag.lastLanding={frame:diag.frames,part:f.part,tiltDeg:Math.round(s.viewUp.angleTo(f.up)*18000/Math.PI)/100,seatM:Math.round(s.seat.length()*1000)/1000};
        diag.orbitalLandings++;
      }
    }
    else if(mode.world.id!=='home'){
      const wade=mode.world.id==='tide'&&s.grounded&&s.travel.lengthSq()>0?tideWalkFactor(scene,s.foot):1;
      moonWalk(mode.world,s,s.travel,speed*wade,dt,false,shellRadius,s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.viewUp,p.y+lift);
    }
    else if(ready){
      if(s.active!==ready){ready.seed(s);s.active=ready;s.parked=null;} // no step or origin recompute from a stale spawn this frame
      else ready.step(s,dt,x,forward,s.tmp.copy(s.localEye).applyQuaternion(s.groundTilt),s.pad.read);
    }else{
      s.active=null;
      surfaceStep(s,s.travel,speed,dt,false,s.pad.read,Math.max(.24,p.y+lift+headMargin),s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.viewUp);
    }
    const stride=s.prev.distanceTo(s.foot);
    if(mode.kind==='ground'&&s.grounded&&mode.landing==='upright'&&s.travel.lengthSq()>0&&stride>0&&
      (p.x-s.offset.x)**2+(p.z-s.offset.z)**2>.015**2&&followFootprint(mode.world,s,s.offset,p,lift,stride,s.pad.read))s.active?.seed(s);
    const end=s.mode,world=viewWorld(end);
    diag.grounded=end.kind==='ground'&&s.grounded;
    if(end.kind==='ground'&&s.grounded){s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.safeTilt.copy(s.groundTilt);s.safeSeat.copy(s.seat);s.safeGround=end;s.safeLift=lift;}
    if(mode.kind==='ground'&&diag.grounded&&s.travel.lengthSq()>0)diag.groundedWalkM+=stride;
    diag.gravityOwner=end.kind==='free'||end.kind==='wind'?null:end.kind==='orbit'?end.flight.owner?.id??null:world.id;
    diag.location=end.kind==='ground'?world.id:end.kind;
    diag.footTravelM+=s.prev.distanceTo(s.foot);
    publishPlanetView(origin,s,lift);
    const probe=s.stance;probe.frame=frame;probe.mode=prefs.movementMode;probe.grounded=diag.grounded;probe.wanted=prefs.normalEyeOffset;probe.lift=lift;
    probe.foot.copy(s.foot);probe.navUp.copy(s.up);probe.centre=world.centre;probe.up.subVectors(s.foot,probe.centre).normalize();
  },-2);
  return <PhysicsBoundary failed={()=>{s.diag.backend='failed';}}><Suspense fallback={null}><Physics driver={driver}/></Suspense></PhysicsBoundary>;
}
