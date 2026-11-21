import {Component,lazy,Suspense,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useXRInputSourceState} from '@react-three/xr';
import {Quaternion,Vector3,type Group,type Mesh} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {WALK_SPEED} from '../mmdVrQuality';
import {newStick,readStick,stickAxis} from './controllerInput';
import {createTraveller,north,surfaceStep,transport,type PlanetDriver} from './planetTravel';
import {observePlanet,planetCounters} from './planetDiagnostics';
import {createPlanetPad} from './planetPad';
import {eyeLift,headMargin} from './eyeHeight';
import {terrainAltitude,stationBlocks} from '../scenery/planet/opalTerrain';

class PhysicsBoundary extends Component<{failed:()=>void;children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.failed();}
  render(){return this.state.failed?null:this.props.children;}
}
type Props={originRef:RefObject<Group|null>;veilRef:RefObject<Mesh|null>;dragging:boolean};

// One owner of the foot, heading, input edges and XR origin for the whole visit.
// Only the optional physics adapter may suspend, never the input/frame callback.
export default function PlanetMotor({originRef,veilRef,dragging}:Props){
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const driver=useRef<PlanetDriver|null>(null);
  const [Physics]=useState(()=>lazy(()=>import('./PlanetPhysics')));
  const [s]=useState(()=>({...createTraveller(),l:newStick(),r:newStick(),offset:new Vector3(),tmp:new Vector3(),travel:new Vector3(),
    safe:new Vector3(),prev:new Vector3(),eye:new Vector3(),localEye:new Vector3(),head:new Quaternion(),safeBasis:new Quaternion(),epoch:-1,free:false,snap:true,a:false,
    active:null as PlanetDriver|null,diag:planetCounters(),pad:createPlanetPad(),lastLift:0}));
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
    if(!pose){s.snap=false;s.a=true;if(s.active){if(s.active===ready)ready.stop();s.active=null;s.velocity.set(0,0,0);}return;}
    diag.poseFrames++;
    const {position:p,orientation:q}=pose.transform,free=prefs.movementMode==='free';
    const dt=Math.min(.05,Math.max(0,elapsed)),speed=WALK_SPEED[prefs.walkSpeedPref==='auto'?'normal':prefs.walkSpeedPref];
    const reset=s.epoch!==viewEpoch;
    if(reset){s.epoch=viewEpoch;s.up.copy(north);s.basis.identity();s.offset.set(p.x,0,p.z);s.foot.set(0,0,1.9);transport(s);
      s.safe.copy(s.foot);s.safeBasis.copy(s.basis);s.grounded=true;s.velocity.set(0,0,0);s.active=null;s.a=s.r.primary;s.snap=true;s.free=false;}
    if(free!==s.free){
      if(free){if(!reset)s.foot.addScaledVector(s.up,s.lastLift);ready?.stop();}
      else{s.foot.copy(s.safe);s.basis.copy(s.safeBasis);s.up.copy(north).applyQuaternion(s.basis);s.velocity.set(0,0,0);s.grounded=true;}
      s.active=null;s.free=free;
    }
    if(Math.abs(s.r.x)<.5)s.snap=true;
    if(dragging)s.snap=false;
    if(Math.abs(s.r.x)>.65&&s.snap){const angle=-Math.sign(s.r.x)*prefs.snapTurnDegrees*Math.PI/180;s.snap=false;diag.snapTurns++;
      s.tmp.set(p.x,0,p.z).sub(s.offset).applyAxisAngle(north,-angle);s.offset.set(p.x,0,p.z).sub(s.tmp);
      s.basis.multiply(s.arc.setFromAxisAngle(north,angle));}
    s.dir.set(0,0,-1).applyQuaternion(s.head.set(q.x,q.y,q.z,q.w)).setY(0);if(s.dir.lengthSq()<1e-7)s.dir.set(0,0,-1);
    s.dir.normalize().applyQuaternion(s.basis);
    const x=dragging?0:stickAxis(s.l.x),forward=dragging?0:-stickAxis(s.l.y),jump=!dragging&&s.r.primary&&!s.a;s.a=s.r.primary;
    s.travel.crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward).clampLength(0,1);
    s.localEye.copy(p).sub(s.offset);
    let room=Infinity;
    if(!free){s.pad.update(scene);
      if(prefs.normalEyeOffset>0&&s.up.y>.8){
        const eye=s.tmp.copy(s.localEye).applyQuaternion(s.basis).add(s.foot),c=s.pad.column(eye.x,eye.z,s.foot.y);
        room=(c.ceiling-(s.grounded?s.foot.y:c.floor))/s.up.y;
      }}
    const lift=free?0:eyeLift(prefs.normalEyeOffset,p.y,room);s.lastLift=lift;s.localEye.y+=lift;
    s.prev.copy(s.foot);
    if(free){s.foot.addScaledVector(s.travel,speed*dt).addScaledVector(s.up,dragging?0:-stickAxis(s.r.y)*speed*dt);}
    else if(ready){
      if(s.active!==ready){ready.seed(s);s.active=ready;} // no step or origin recompute from a stale spawn this frame
      else ready.step(s,dt,x,forward,jump,s.localEye);
    }else{
      s.active=null;
      surfaceStep(s,s.travel,speed,dt,jump,s.pad.read,Math.max(.24,s.localEye.y+headMargin));
    }
    if(!free&&s.grounded){s.safe.copy(s.foot);s.safeBasis.copy(s.basis);}
    diag.footTravelM+=s.prev.distanceTo(s.foot);
    origin.quaternion.copy(s.basis);origin.position.copy(s.foot).sub(s.tmp.copy(s.offset).applyQuaternion(s.basis));
    if(!free)origin.position.addScaledVector(s.up,lift);
    origin.updateMatrixWorld(true);
    const veil=veilRef.current;if(veil){s.eye.copy(p).applyQuaternion(s.basis).add(origin.position);veil.position.copy(p);
      let blocked=!free&&(s.localEye.y<.055||terrainAltitude(s.eye)<.055||stationBlocks(s.eye,.055,.055));
      if(!free&&!blocked){if(ready)blocked=ready.headBlocked(s.eye,s.basis);
        else if(s.up.y>.8){const c=s.pad.column(s.eye.x,s.eye.z,s.foot.y);
          blocked=c.blocked||s.eye.y<c.floor+.055||s.eye.y+headMargin>c.ceiling+.001;}}
      veil.visible=blocked;}
  },-2);
  return <PhysicsBoundary failed={()=>{s.diag.backend='failed';}}><Suspense fallback={null}><Physics driver={driver}/></Suspense></PhysicsBoundary>;
}
