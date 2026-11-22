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
import {startTwinLeap,stepTwinLeap,type TwinLeap} from './twinLeap';
import {useBackpack} from '../backpack';

class PhysicsBoundary extends Component<{failed:()=>void;children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.failed();}
  render(){return this.state.failed?null:this.props.children;}
}
type Props={originRef:RefObject<Group|null>;dragging:boolean};

// One owner of the foot, heading, input edges and XR origin for the whole visit.
// Only the optional physics adapter may suspend, never the input/frame callback.
export default function PlanetMotor({originRef,dragging}:Props){
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const driver=useRef<PlanetDriver|null>(null);
  const [Physics]=useState(()=>lazy(()=>import('./PlanetPhysics')));
  const [s]=useState(()=>({...createTraveller(),l:newStick(),r:newStick(),offset:new Vector3(),tmp:new Vector3(),travel:new Vector3(),
    safe:new Vector3(),prev:new Vector3(),localEye:new Vector3(),head:new Quaternion(),safeBasis:new Quaternion(),epoch:-1,free:false,snap:true,a:false,
    active:null as PlanetDriver|null,parked:null as PlanetDriver|null,diag:planetCounters(),pad:createPlanetPad(),lastLift:0,
    moon:null as WalkMoon|null,ride:null as Ride|null,leap:null as TwinLeap|null,xDown:false,windSupportFrames:2}));
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
    if(!pose){s.snap=false;s.a=s.xDown=true;s.windSupportFrames=0;if(s.active){if(s.active===ready)ready.stop();s.active=null;s.velocity.set(0,0,0);}return;}
    diag.poseFrames++;
    const {position:p,orientation:q}=pose.transform,free=prefs.movementMode==='free';
    const dt=Math.min(.05,Math.max(0,elapsed)),speed=WALK_SPEED[prefs.walkSpeedPref==='auto'?'normal':prefs.walkSpeedPref];
    const reset=s.epoch!==viewEpoch;
    if(reset){s.moon=null;s.ride=null;s.leap=null;s.xDown=s.l.primary;s.epoch=viewEpoch;s.up.copy(north);s.basis.identity();s.offset.set(p.x,0,p.z);s.foot.set(0,0,1.9);transport(s);
      s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=true;s.velocity.set(0,0,0);s.active=null;s.a=s.r.primary;s.snap=true;s.free=false;s.windSupportFrames=2;}
    if(free!==s.free){
      if(free){if(s.leap)s.moon=s.leap.from; // safe foot is the last grounded take-off point
        s.ride=null;s.leap=null;if(!reset)s.foot.addScaledVector(s.up,s.lastLift);}
      else{s.foot.copy(s.safe);s.basis.copy(s.safeBasis);s.up.copy(north).applyQuaternion(s.basis);s.velocity.set(0,0,0);s.grounded=true;}
      s.active=null;s.free=free;s.a=s.r.primary;s.xDown=s.l.primary;
    }
    if(Math.abs(s.r.x)<.5)s.snap=true;
    if(dragging)s.snap=false;
    if(Math.abs(s.r.x)>.65&&s.snap){const angle=-Math.sign(s.r.x)*prefs.snapTurnDegrees*Math.PI/180;s.snap=false;diag.snapTurns++;
      s.tmp.set(p.x,0,p.z).sub(s.offset).applyAxisAngle(north,-angle);s.offset.set(p.x,0,p.z).sub(s.tmp);
      s.basis.multiply(s.arc.setFromAxisAngle(north,angle));}
    s.dir.set(0,0,-1).applyQuaternion(s.head.set(q.x,q.y,q.z,q.w)).setY(0);if(s.dir.lengthSq()<1e-7)s.dir.set(0,0,-1);
    s.dir.normalize().applyQuaternion(s.basis);
    const x=dragging?0:stickAxis(s.l.x),forward=dragging?0:-stickAxis(s.l.y),jump=!dragging&&s.r.primary&&!s.a;s.a=s.r.primary||s.r.via==='none';
    s.travel.crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward).clampLength(0,1);
    s.localEye.copy(p).sub(s.offset);
    let room=Infinity;
    if(!free&&!s.moon&&!s.ride){s.pad.update(scene);
      if(prefs.normalEyeOffset>0&&s.up.y>.8){
        const eye=s.tmp.copy(s.localEye).applyQuaternion(s.basis).add(s.foot),c=s.pad.column(eye.x,eye.z,s.foot.y);
        room=(c.ceiling-(s.grounded?s.foot.y:c.floor))/s.up.y;
      }}
    const lift=free?0:eyeLift(prefs.normalEyeOffset,p.y,room);s.lastLift=lift;s.localEye.y+=lift;
    s.prev.copy(s.foot);
    // Ecctrl's support cast has 28 cm of forgiveness, and its jump impulse
    // can be applied after this frame callback. A fresh A or fast radial
    // ascent/descent breaks support even if the cached cast still says true.
    s.windSupportFrames=!free&&!s.ride&&!s.leap&&!jump&&s.grounded&&Math.abs(s.velocity.dot(s.up))<.30?Math.min(2,s.windSupportFrames+1):0;
    if(!dragging&&s.windSupportFrames===2&&s.l.primary&&!s.xDown&&!useBackpack.getState().draft){
      // Account for the real room-scale offset when the visitor steps into
      // the collar. Rebase without a camera jump and land over the return pad.
      const actual=s.tmp.set(s.localEye.x,0,s.localEye.z).applyQuaternion(s.basis).add(s.foot);
      const lane=departureAt(actual,s.moon);
      if(lane){s.foot.copy(actual);s.offset.set(p.x,0,p.z);s.localEye.x=s.localEye.z=0;s.ride=startRide(lane,!!s.moon,s.foot);s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=false;s.velocity.set(0,0,0);s.active=null;diag.windDepartures++;}
    }
    s.xDown=s.l.primary||s.l.via==='none';
    if(s.moon&&jump&&s.grounded&&!s.ride&&!s.leap&&!free&&!useBackpack.getState().draft){
      const actual=s.tmp.set(s.localEye.x,0,s.localEye.z).applyQuaternion(s.basis).add(s.foot);
      s.leap=startTwinLeap(s.moon,actual,s.up);
      if(s.leap){diag.twinDepartures++;s.safe.copy(s.leap.position);s.safeBasis.copy(s.basis);
        s.offset.set(p.x,0,p.z);s.localEye.x=s.localEye.z=0;s.grounded=false;}
    }
    // The optional body can first become valid halfway between moons.
    if(ready&&(free||s.ride||s.moon)&&s.parked!==ready){ready.stop();s.parked=ready;}
    if(free){s.foot.addScaledVector(s.travel,speed*dt).addScaledVector(s.up,dragging?0:-stickAxis(s.r.y)*speed*dt);}
    else if(s.ride){
      const done=rideStep(s.ride,dragging?0:dt,s.foot,s.radial);
      s.basis.premultiply(s.arc.setFromUnitVectors(s.up,s.radial)).normalize();s.up.copy(s.radial);
      if(done){s.moon=s.ride.returning?null:s.ride.lane.moon;s.ride=null;s.velocity.set(0,0,0);s.grounded=true;diag.windLandings++;}
    }
    else if(s.leap){
      const done=stepTwinLeap(s.leap,dragging?0:dt,s.foot,s.radial);
      s.basis.premultiply(s.arc.setFromUnitVectors(s.up,s.radial)).normalize();s.up.copy(s.radial);
      s.moon=s.leap.owner;s.velocity.copy(s.leap.velocity);
      if(done){s.leap=null;s.velocity.set(0,0,0);s.grounded=true;diag.twinLandings++;}
    }
    else if(s.moon)moonWalk(s.moon,s,s.travel,speed,dt,jump);
    else if(ready){
      if(s.active!==ready){ready.seed(s);s.active=ready;s.parked=null;} // no step or origin recompute from a stale spawn this frame
      else ready.step(s,dt,x,forward,jump,s.localEye);
    }else{
      s.active=null;
      surfaceStep(s,s.travel,speed,dt,jump,s.pad.read,Math.max(.24,s.localEye.y+headMargin));
    }
    if(!free&&s.grounded){s.safe.copy(s.foot);s.safeBasis.copy(s.basis);}
    diag.gravityOwner=free||s.ride?null:s.moon?.id??'home';
    diag.location=free?'free':s.ride?'wind':s.leap?'twinLeap':s.moon?.id??'home';
    diag.footTravelM+=s.prev.distanceTo(s.foot);
    origin.quaternion.copy(s.basis);origin.position.copy(s.foot).sub(s.tmp.copy(s.offset).applyQuaternion(s.basis));
    if(!free)origin.position.addScaledVector(s.up,lift);
    origin.updateMatrixWorld(true);
  },-2);
  return <PhysicsBoundary failed={()=>{s.diag.backend='failed';}}><Suspense fallback={null}><Physics driver={driver}/></Suspense></PhysicsBoundary>;
}
