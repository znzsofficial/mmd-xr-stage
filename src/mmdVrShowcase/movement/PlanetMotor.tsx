import {Component,lazy,Suspense,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useXRInputSourceState} from '@react-three/xr';
import {Quaternion,Vector3,type Group} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {WALK_SPEED} from '../mmdVrQuality';
import {newStick,readStick,stickAxis} from './controllerInput';
import {createTraveller,north,surfaceStep,transport,type PlanetDriver} from './planetTravel';
import {observePlanet,planetCounters} from './planetDiagnostics';
import {createPlanetPad} from './planetPad';
import {eyeLift,headMargin} from './eyeHeight';
import {departureAt,rideStep,startRide,type WalkMoon,type Ride} from '../scenery/planet/windAtlas';
import {moonWalk} from './moonWalk';
import {tideEyeLift} from './tideContact';
import {tideWalkFactor} from '../scenery/planet/tideSession';
import {startTwinLeap,stepTwinLeap,type TwinLeap} from './twinLeap';
import {jumpVelocity,startOrbit,stepOrbit,type Orbit} from './orbitalFlight';
import {altitude,homeWorld,shellRadius} from './orbitalSurfaces';
import {standingArrival,riseToFeet,type StandingArrival} from './landingTurn';
import {useBackpack} from '../backpack';

class PhysicsBoundary extends Component<{failed:()=>void;children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.failed();}
  render(){return this.state.failed?null:this.props.children;}
}
type Props={originRef:RefObject<Group|null>;dragging:boolean};
const noTilt=new Quaternion(),localLandingAngle=Math.PI/9;

// One owner of the foot, heading, input edges and XR origin for the whole visit.
// Only the optional physics adapter may suspend, never the input/frame callback.
export default function PlanetMotor({originRef,dragging}:Props){
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const driver=useRef<PlanetDriver|null>(null);
  const [Physics]=useState(()=>lazy(()=>import('./PlanetPhysics')));
  const [s]=useState(()=>({...createTraveller(),l:newStick(),r:newStick(),offset:new Vector3(),tmp:new Vector3(),travel:new Vector3(),
    safe:new Vector3(),safeOffset:new Vector3(),prev:new Vector3(),localEye:new Vector3(),head:new Quaternion(),safeBasis:new Quaternion(),epoch:-1,free:false,snap:true,a:false,
    active:null as PlanetDriver|null,parked:null as PlanetDriver|null,diag:planetCounters(),pad:createPlanetPad(),lastLift:0,
    moon:null as WalkMoon|null,safeMoon:null as WalkMoon|null,ride:null as Ride|null,leap:null as TwinLeap|null,orbit:null as Orbit|null,
     xDown:false,yDown:false,windSupportFrames:2,pending:false,landing:new Vector3(),landingOffset:new Vector3(),
    landingArc:new Quaternion(),pathUp:new Vector3(),worldEye:new Vector3(),routeEyeHeight:0,
    display:new Quaternion(),viewUp:new Vector3(),groundTilt:new Quaternion(),safeTilt:new Quaternion(),turn:null as StandingArrival|null}));
  // Rebase the tracked sole once, keep the old displayed pose, and give the
  // actual walking motor its ground now (not after a camera animation).
  function acceptSupport(){
    s.foot.add(s.tmp.copy(s.landingOffset).applyQuaternion(s.basis));s.offset.add(s.landingOffset);s.localEye.sub(s.landingOffset);s.landingOffset.set(0,0,0);
    s.turn=standingArrival(s.foot,s.basis);
    s.basis.premultiply(s.landingArc).normalize();s.up.copy(north).applyQuaternion(s.basis);
    s.foot.copy(s.landing);s.groundTilt.identity();s.pending=false;s.windSupportFrames=0;
  }
  useLayoutEffect(()=>{const unbind=observePlanet(s.diag);return()=>{unbind();s.pad.dispose();};},[s]);
  useFrame(({gl,scene},elapsed,frame)=>{
    const origin=originRef.current,space=gl.xr.getReferenceSpace();if(!origin||!frame)return;
    const {prefs,viewEpoch}=useMmdVrStore.getState(),{diag}=s,d=driver.current;
    diag.frames++;readStick(frame.session.inputSources,'left',left,s.l);readStick(frame.session.inputSources,'right',right,s.r);
    diag.left=s.l.via;diag.right=s.r.via;
    if(Math.abs(s.l.x)>.16||Math.abs(s.l.y)>.16)diag.walkInputFrames++;
    if(Math.abs(s.r.x)>.65)diag.turnInputFrames++;
    if(dragging)diag.inputHeldFrames++;
    const pose=space&&(!frame.session.visibilityState||frame.session.visibilityState==='visible')&&frame.getViewerPose(space);
    const ready=d?.ready()?d:null;if(diag.backend!=='failed')diag.backend=ready?'rapier':'pending';
    if(!ready)s.parked=null;
    if(!pose){s.snap=false;s.a=s.xDown=s.yDown=true;s.windSupportFrames=0;if(s.active){if(s.active===ready)ready.stop();s.active=null;s.velocity.set(0,0,0);}return;}
    diag.poseFrames++;
    const {position:p,orientation:q}=pose.transform,free=prefs.movementMode==='free';
    const dt=Math.min(.05,Math.max(0,elapsed)),speed=WALK_SPEED[prefs.walkSpeedPref==='auto'?'normal':prefs.walkSpeedPref];
    const reset=s.epoch!==viewEpoch;
    if(reset){s.moon=s.safeMoon=null;s.ride=null;s.leap=null;s.orbit=null;s.turn=null;s.pending=false;s.xDown=s.l.primary;s.yDown=s.l.align;s.epoch=viewEpoch;s.up.copy(north);s.basis.identity();s.groundTilt.identity();s.safeTilt.identity();s.offset.set(p.x,0,p.z);s.foot.set(0,0,1.9);transport(s);
      s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.grounded=true;s.velocity.set(0,0,0);s.active=null;s.a=s.r.primary;s.snap=true;s.free=false;s.windSupportFrames=2;}
    if(free!==s.free){
       if(free){if(s.turn){s.foot.copy(s.turn.foot);s.basis.copy(s.turn.basis);}s.ride=null;s.leap=null;s.orbit=null;s.basis.multiply(s.groundTilt);s.groundTilt.identity();s.up.copy(north).applyQuaternion(s.basis);if(!reset)s.foot.addScaledVector(s.up,s.lastLift);}
       else{s.foot.copy(s.safe);s.basis.copy(s.safeBasis);s.groundTilt.copy(s.safeTilt);s.offset.copy(s.safeOffset);s.up.copy(north).applyQuaternion(s.basis);s.moon=s.safeMoon;s.velocity.set(0,0,0);s.grounded=true;}
       s.pending=false;s.turn=null;s.active=null;s.free=free;s.a=s.r.primary;s.xDown=s.l.primary;s.yDown=s.l.align;
    }
    if(Math.abs(s.r.x)<.5)s.snap=true;
    if(dragging)s.snap=false;
    if(Math.abs(s.r.x)>.65&&s.snap){const angle=-Math.sign(s.r.x)*prefs.snapTurnDegrees*Math.PI/180;s.snap=false;diag.snapTurns++;
      s.tmp.set(p.x,0,p.z).sub(s.offset).applyAxisAngle(north,-angle);s.offset.set(p.x,0,p.z).sub(s.tmp);
      s.basis.multiply(s.arc.setFromAxisAngle(north,angle));
      s.turn?.basis.multiply(s.arc);
      if(!s.groundTilt.equals(noTilt)){s.groundTilt.multiply(s.arc).premultiply(s.arc.invert());}}
    if(s.turn)s.display.copy(s.turn.basis);else s.display.multiplyQuaternions(s.basis,s.groundTilt);s.viewUp.copy(north).applyQuaternion(s.display);
    s.dir.set(0,0,-1).applyQuaternion(s.head.set(q.x,q.y,q.z,q.w)).setY(0);if(s.dir.lengthSq()<1e-7)s.dir.set(0,0,-1);
    s.dir.normalize().applyQuaternion(s.turn?s.basis:s.display).projectOnPlane(s.up).normalize();
    const x=dragging?0:stickAxis(s.l.x),forward=dragging?0:-stickAxis(s.l.y),jump=!dragging&&s.r.primary&&!s.a;s.a=s.r.primary||s.r.via==='none';
    s.travel.crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward).clampLength(0,1);
    s.localEye.copy(p).sub(s.offset);
    const align=!free&&s.pending&&!prefs.planetAutoLanding&&!dragging&&s.l.align&&!s.yDown&&!useBackpack.getState().draft;
    s.yDown=s.l.align||s.l.via==='none';
    if(align){s.turn=null;s.pending=false;s.windSupportFrames=0;diag.alignments++;s.display.copy(s.basis);s.viewUp.copy(s.up);}
    else if(!free&&s.pending&&!dragging&&!useBackpack.getState().draft&&(prefs.planetAutoLanding||s.travel.lengthSq()>.001))s.pending=false;
    let room=Infinity;
    if(!free&&(!s.moon||s.orbit)&&!s.ride){s.pad.update(scene);
       if(prefs.normalEyeOffset>0&&s.viewUp.y>.8){
         const eye=s.tmp.copy(s.localEye).applyQuaternion(s.display).add(s.foot),c=s.pad.column(eye.x,eye.z,s.foot.y);
         room=(c.ceiling-(s.grounded?s.foot.y:c.floor))/s.viewUp.y;
      }}
    let lift=free?0:eyeLift(prefs.normalEyeOffset,p.y,room);
    if(lift>0&&s.moon?.id==='tide'&&!s.ride)lift=tideEyeLift(s.foot,s.viewUp,s.worldEye.copy(s.localEye).applyQuaternion(s.display),lift);
    s.lastLift=lift;s.localEye.y+=lift;
    s.prev.copy(s.foot);
    // Ecctrl's suspension cast has 28 cm of forgiveness. Require two quiet
    // supported frames and a fresh X; an airborne press is never a booking.
    s.windSupportFrames=!free&&!s.pending&&!s.turn&&!s.ride&&!s.leap&&!s.orbit&&!jump&&s.grounded&&Math.abs(s.velocity.dot(s.up))<.30?Math.min(2,s.windSupportFrames+1):0;
    if(!dragging&&s.windSupportFrames===2&&s.l.primary&&!s.xDown&&!useBackpack.getState().draft){
      // Account for the real room-scale offset when the visitor steps into
      // the collar. Rebase without a camera jump and land over the return pad.
      const actual=s.tmp.set(s.localEye.x,0,s.localEye.z).applyQuaternion(s.display).add(s.foot);
      const lane=departureAt(actual,s.moon);
      if(lane){s.foot.copy(actual);s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.localEye.x=s.localEye.z=0;s.ride=startRide(lane,!!s.moon,s.foot);s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=false;s.velocity.set(0,0,0);s.active=null;diag.windDepartures++;}
    }
    s.xDown=s.l.primary||s.l.via==='none';
    if(s.moon&&jump&&s.grounded&&!align&&!s.pending&&!s.turn&&!s.ride&&!s.leap&&!free&&!useBackpack.getState().draft){
      const actual=s.tmp.set(s.localEye.x,0,s.localEye.z).applyQuaternion(s.display).add(s.foot);
      s.leap=startTwinLeap(s.moon,actual,s.viewUp);
      if(s.leap){diag.twinDepartures++;s.safe.copy(s.leap.position);s.safeBasis.copy(s.basis);
        s.offset.set(p.x,0,p.z);s.safeOffset.copy(s.offset);s.localEye.x=s.localEye.z=0;s.grounded=false;}
    }
    if(!free&&!s.pending&&!s.turn&&!align&&!s.ride&&!s.leap&&!s.orbit){
      const world=s.moon??homeWorld;
      // A cached suspension cast can briefly lose the ground on a slope. A
      // passive launch needs actual clearance beyond its 28 cm support band,
      // including imported floors on the north deck. A deliberately pressed
      // A still transfers to the all-world sweep on the very first frame.
      let off=!s.grounded&&s.velocity.dot(s.up)<-.30&&altitude(world,s.foot)>.32;
      if(off&&world===homeWorld&&s.up.y>.8){const c=s.pad.column(s.foot.x,s.foot.z,s.foot.y);off=!c.blocked&&s.foot.y-c.floor>.32;}
      if((jump&&s.grounded)||off){s.orbit=startOrbit(world,s.foot,off?s.velocity:jumpVelocity(world,s.up,s.travel,speed,s.tmp));
        s.grounded=false;s.active=null;diag.orbitalJumps++;}
    }
    // A subsequent flight inherits the horizon the visitor actually sees.
    if((s.orbit||s.ride||s.leap)&&!s.groundTilt.equals(noTilt)){s.basis.copy(s.display);s.up.copy(s.viewUp);s.groundTilt.identity();}
    if((s.ride?.time===0||s.leap?.time===0)&&!free){s.pathUp.copy(s.up);s.landingArc.identity();s.routeEyeHeight=s.leap?Math.max(.2,s.localEye.y):0;}
    // The optional body can first become valid halfway between moons.
    if(ready&&(free||s.ride||s.moon||s.orbit||s.pending)&&s.parked!==ready){ready.stop();s.parked=ready;}
    const groundFrame=!free&&!s.pending&&!align&&!s.ride&&!s.leap&&!s.orbit;
    const groundSpeed=s.turn?Math.min(.85,speed):speed;
    if(free){s.foot.addScaledVector(s.travel,speed*dt).addScaledVector(s.up,dragging?0:-stickAxis(s.r.y)*speed*dt);}
    else if(s.ride||s.leap){
      let done=false;
      if(s.leap){done=stepTwinLeap(s.leap,dragging?0:dt,s.foot,s.radial);s.moon=s.leap.owner;s.velocity.copy(s.leap.velocity);
        if(done){s.leap=null;diag.twinLandings++;}}
      else if(s.ride){done=rideStep(s.ride,dragging?0:dt,s.foot,s.radial);
        if(done){s.moon=s.ride.returning?null:s.ride.lane.moon;s.ride=null;diag.windLandings++;}}
      // Transport a separate navigation frame along the authored route. On
      // opposing surfaces keep the nominal EYE on its surveyed clear arc,
      // without rolling the headset. Explicit alignment pivots about that eye.
      s.landingArc.premultiply(s.arc.setFromUnitVectors(s.pathUp,s.radial)).normalize();s.pathUp.copy(s.radial);
      s.landing.copy(s.foot);s.foot.addScaledVector(s.radial,s.routeEyeHeight).addScaledVector(s.up,-s.routeEyeHeight);
      if(done){s.landingOffset.set(0,0,0);
        if(s.up.angleTo(s.radial)>1e-4){acceptSupport();s.pending=!prefs.planetAutoLanding;}
        s.grounded=true;s.velocity.set(0,0,0);}
    }
    else if(s.orbit){
      const f=s.orbit,changes=f.changes,grazes=f.grazes;
      const done=stepOrbit(f,dt,s.up,s.worldEye.copy(s.localEye).applyQuaternion(s.basis),s.pad.read);
      diag.wellChanges+=f.changes-changes;diag.grazes+=f.grazes-grazes;
      s.foot.copy(f.foot);s.velocity.copy(f.velocity);
      if(done&&f.landing){
        s.landing.copy(f.point);s.landingOffset.set(f.tracked?s.localEye.x:0,0,f.tracked?s.localEye.z:0);
        s.landingArc.setFromUnitVectors(s.up,f.up);
        // At an exact antipode the shortest roll has no unique axis. Use the
        // launch heading so alignment doesn't arbitrarily reverse the view.
        if(s.up.dot(f.up)<-.999999){s.tmp.set(0,0,-1).applyQuaternion(s.basis);s.landingArc.setFromAxisAngle(s.tmp,Math.PI);
          s.pathUp.copy(s.up).applyQuaternion(s.landingArc);s.landingArc.premultiply(s.arc.setFromUnitVectors(s.pathUp,f.up));}
        const angle=s.up.angleTo(f.up);
        // On a sloping pad the rounded lowest body section may beat the sole
        // by millimetres. That is still an ordinary feet-first landing.
        const sideHit=f.part==='body'&&Math.abs(s.tmp.subVectors(s.foot,f.point).dot(f.up))>.20;
        if(f.landing!==f.from||angle>localLandingAngle||f.part==='head'||sideHit||(prefs.planetAutoLanding&&angle>.003))acceptSupport();
        else {
          // Resume the local motor on its true support immediately. Keep the
          // display horizon at touchdown until the visitor actually walks.
          s.display.copy(s.basis);s.basis.premultiply(s.landingArc).normalize();s.up.copy(f.up);
          s.groundTilt.copy(s.basis).invert().multiply(s.display).normalize();
          s.foot.copy(f.point);s.offset.add(s.landingOffset);s.localEye.sub(s.landingOffset);
        }
        s.moon=f.landing.id==='home'?null:f.landing;s.grounded=true;s.orbit=null;diag.orbitalLandings++;
      }
    }
    else if(s.pending||align){/* Hold an explicitly parked wind/pad view until a walk, Y or auto-align. */}
    else if(s.moon){
      const wade=s.moon.id==='tide'&&s.grounded&&s.travel.lengthSq()>0?tideWalkFactor(scene,s.foot):1;
      moonWalk(s.moon,s,s.travel,groundSpeed*wade,dt,false,shellRadius,s.worldEye.copy(s.localEye).applyQuaternion(s.display),s.viewUp);
    }
    else if(ready){
      if(s.active!==ready){ready.seed(s);s.active=ready;s.parked=null;} // no step or origin recompute from a stale spawn this frame
      else ready.step(s,dt,x*groundSpeed/speed,forward*groundSpeed/speed,false,s.tmp.copy(s.localEye).applyQuaternion(s.groundTilt));
    }else{
      s.active=null;
      surfaceStep(s,s.travel,groundSpeed,dt,false,s.pad.read,Math.max(.24,s.localEye.y+headMargin));
    }
    if(groundFrame&&s.travel.lengthSq()>0&&!s.groundTilt.equals(noTilt)){
      const angle=s.groundTilt.angleTo(noTilt),limit=.45*Math.min(s.prev.distanceTo(s.foot),speed*dt);
      if(angle<=limit+1e-6)s.groundTilt.identity();else s.groundTilt.slerp(noTilt,limit/angle);
    }
    if(groundFrame&&s.turn&&riseToFeet(s.turn,dt,s.localEye,s.foot,s.basis)){s.turn=null;diag.alignments++;}
    if(!free&&s.grounded){s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.safeOffset.copy(s.offset);s.safeTilt.copy(s.groundTilt);s.safeMoon=s.moon;}
    diag.awaitingAlignment=!free&&s.pending;
    diag.grounded=!free&&s.grounded;
    if(groundFrame&&diag.grounded&&s.travel.lengthSq()>0)diag.groundedWalkM+=s.prev.distanceTo(s.foot);
    diag.autoAligning=!!s.turn&&!s.pending;diag.alignmentBlocked=s.turn?.blocked??false;
    diag.gravityOwner=free||s.ride?null:s.orbit?s.orbit.owner?.id??null:s.moon?.id??'home';
    diag.location=free?'free':s.ride?'wind':s.leap?'twinLeap':s.orbit?'orbit':s.moon?.id??'home';
    diag.footTravelM+=s.prev.distanceTo(s.foot);
    if(s.turn)origin.quaternion.copy(s.turn.basis);else origin.quaternion.multiplyQuaternions(s.basis,s.groundTilt);origin.position.copy(s.turn?.foot??s.foot).sub(s.tmp.copy(s.offset).applyQuaternion(origin.quaternion));
    if(!free)origin.position.addScaledVector(s.viewUp.copy(north).applyQuaternion(origin.quaternion),lift);
    origin.updateMatrixWorld(true);
  },-2);
  return <PhysicsBoundary failed={()=>{s.diag.backend='failed';}}><Suspense fallback={null}><Physics driver={driver}/></Suspense></PhysicsBoundary>;
}
