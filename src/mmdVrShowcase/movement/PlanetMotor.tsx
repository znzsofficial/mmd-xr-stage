import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {useThree,useFrame} from '@react-three/fiber';
import {useXRInputSourceState} from '@react-three/xr';
import {BallCollider,CylinderCollider,Physics,RigidBody,useRapier} from '@react-three/rapier';
import {Ecctrl,type EcctrlHandle} from 'ecctrl';
import {useCustomGravity} from 'ecctrl/gravity';
import {Matrix4,Quaternion,Vector3,type Group,type Mesh,type InstancedMesh} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {useBackpack} from '../backpack';
import {WALK_SPEED} from '../mmdVrQuality';
import {actorBodies} from './actorBodies';
import {PAD_RADIUS,PLANET_RADIUS as R} from '../scenery/planet/planetLayout';

const centre=new Vector3(0,-R,0),north=new Vector3(0,1,0),zero={x:0,y:0,z:0};
const spawn:[number,number,number]=[0,.8,1.9];
const axis=(a=0)=>Math.sign(a)*Math.max(0,(Math.min(1,Math.abs(a))-.16)/.84);
type Props={originRef:RefObject<Group|null>;veilRef:RefObject<Mesh|null>;dragging:boolean};

// Only mounted for this sphere. Static GLB surfaces must stay hollow; PMX
// occupancies use the same narrow torso proxies as the planar motor.
function LandingSolids(){
  const {rapier,world}=useRapier(),scene=useThree(s=>s.scene),live=useBackpack(s=>s.live);
  useLayoutEffect(()=>{
    const fixed=world.createRigidBody(rapier.RigidBodyDesc.fixed());
    for(const b of actorBodies(useBackpack.getState().entries,live)){
      if(b.top>b.bottom&&b.r>0)world.createCollider(rapier.ColliderDesc.cylinder((b.top-b.bottom)/2,b.r).setTranslation(b.x,(b.top+b.bottom)/2,b.z),fixed);
    }
    const v=new Vector3(),m=new Matrix4();
    for(const root of scene.children.filter(o=>o.userData.stagePropSolid)){root.updateWorldMatrix(true,true);root.traverseVisible(o=>{
      const mesh=o as InstancedMesh;if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position;if(!p)return;
      const i=g.index,start=g.drawRange.start,end=Math.min(i?.count??p.count,start+g.drawRange.count),len=Math.floor((end-start)/3)*3;if(len<=0)return;
      const indices=Uint32Array.from({length:len},(_,k)=>i?i.getX(start+k):start+k);
      for(let k=0;k<(mesh.isInstancedMesh?mesh.count:1);k++){
        if(mesh.isInstancedMesh){mesh.getMatrixAt(k,m);m.premultiply(mesh.matrixWorld)}else m.copy(mesh.matrixWorld);
        const vertices=new Float32Array(p.count*3);for(let j=0;j<p.count;j++)v.fromBufferAttribute(p,j).applyMatrix4(m).toArray(vertices,j*3);
        world.createCollider(rapier.ColliderDesc.trimesh(vertices,indices),fixed);
      }
    })}
    return ()=>{if(fixed.isValid())world.removeRigidBody(fixed)};
  },[rapier,world,scene,live]);return null;
}

function Walker({originRef,veilRef,dragging}:Props){
  const player=useRef<EcctrlHandle>(null),left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const mode=useMmdVrStore(s=>s.prefs.movementMode),pref=useMmdVrStore(s=>s.prefs.walkSpeedPref),speed=WALK_SPEED[pref==='auto'?'normal':pref];
  const {world,rapier,step}=useRapier();
  const [s]=useState(()=>({basis:new Quaternion(),turn:new Quaternion(),head:new Quaternion(),up:north.clone(),next:new Vector3(),tmp:new Vector3(),dir:new Vector3(),right:new Vector3(),offset:new Vector3(),at:new Vector3(),fly:new Vector3(),foot:new Vector3(),safe:new Vector3(...spawn),safeQ:new Quaternion(),eye:new Vector3(),headShape:new rapier.Ball(.055),epoch:-1,free:false,snap:true}));
  useLayoutEffect(()=>{const store=useCustomGravity.getState(),prev=store.gravityField,force=new Vector3();
    store.setGravityField(p=>force.subVectors(centre,p).normalize().multiplyScalar(2.5));return()=>store.setGravityField(prev);
  },[]);
  useFrame(({gl},elapsed,frame)=>{
    const origin=originRef.current,c=player.current,space=gl.xr.getReferenceSpace();if(!origin||!c?.body)return;
    // One impulse evaluation per render. Never feed Ecctrl's suspension a
    // multi-frame delta on first load, a compositor stall or resuming tracking.
    const stepTime=Math.min(1/60,Math.max(0,elapsed));if(stepTime>0)step(stepTime);
    const pose=space&&frame?.session.visibilityState==='visible'?frame.getViewerPose(space):null;
    if(!pose){c.setMovement({joystick:{x:0,y:0},jump:false});return}
    const {position,orientation}=pose.transform,{prefs,viewEpoch}=useMmdVrStore.getState();
    const free=mode==='free',dt=Math.min(.05,Math.max(0,elapsed));
    if(viewEpoch!==s.epoch){s.epoch=viewEpoch;s.basis.identity();s.up.copy(north);s.offset.set(position.x,0,position.z);s.safe.set(...spawn);s.safeQ.identity();s.fly.set(0,0,spawn[2]);s.snap=true;
      c.body.setEnabled(true);c.body.setTranslation(s.safe,true);c.body.setRotation(s.safeQ,true);c.body.setLinvel(zero,true);c.body.setAngvel(zero,true);s.free=false;}
    if(free!==s.free){if(free){s.fly.copy(c.body.translation()).addScaledVector(s.up,-.8);c.body.setEnabled(false)}else{c.body.setEnabled(true);c.body.setTranslation(s.safe,true);c.body.setRotation(s.safeQ,true);c.body.setLinvel(zero,true);c.body.setAngvel(zero,true)}s.free=free;}
    s.at.copy(c.body.translation());
    if(!free){s.next.subVectors(s.at,centre).normalize();
      // Parallel transport from the last radial normal. Never derive a heading
      // from world north: it flips when a traveller crosses a pole.
      s.basis.premultiply(s.turn.setFromUnitVectors(s.up,s.next)).normalize();s.up.copy(s.next);
      if(c.isOnGround){s.safe.copy(s.at);s.safeQ.copy(c.body.rotation())}}
    const l=left?.gamepad['xr-standard-thumbstick'],r=right?.gamepad['xr-standard-thumbstick'];
    const turn=r?.xAxis??0;if(Math.abs(turn)<.5)s.snap=true;
    if(!dragging&&Math.abs(turn)>.65&&s.snap){const angle=-Math.sign(turn)*prefs.snapTurnDegrees*Math.PI/180;s.snap=false;
      // Rotate the play space around the tracked eye rather than its origin.
      s.tmp.set(position.x,0,position.z).sub(s.offset).applyAxisAngle(north,-angle);s.offset.set(position.x,0,position.z).sub(s.tmp);
      s.basis.multiply(s.turn.setFromAxisAngle(north,angle));}
    s.dir.set(0,0,-1).applyQuaternion(s.head.copy(orientation)).setY(0);if(s.dir.lengthSq()<1e-7)s.dir.set(0,0,-1);s.dir.normalize().applyQuaternion(s.basis);
    const x=dragging?0:axis(l?.xAxis),z=dragging?0:-axis(l?.yAxis);
    if(free){s.right.crossVectors(s.dir,s.up);s.fly.addScaledVector(s.dir,z*speed*dt).addScaledVector(s.right,x*speed*dt).addScaledVector(s.up,dragging?0:-axis(r?.yAxis)*speed*dt);s.foot.copy(s.fly)}
    else{c.setForwardDir(s.dir);c.setMovement({joystick:{x,y:z},jump:!dragging&&right?.gamepad['a-button']?.state==='pressed'});s.foot.copy(s.at).addScaledVector(s.up,-.8)}
    origin.quaternion.copy(s.basis);origin.position.copy(s.foot).sub(s.tmp.copy(s.offset).applyQuaternion(s.basis));origin.updateMatrixWorld(true);
    const veil=veilRef.current;if(veil){s.eye.copy(position).applyQuaternion(s.basis).add(origin.position);veil.position.copy(position);veil.visible=!free&&(position.y<.055||world.intersectionWithShape(s.eye,s.basis,s.headShape,undefined,undefined,c.collider,c.body)!==null)}
  },-1);
  return <><LandingSolids/><RigidBody type="fixed" colliders={false}><BallCollider args={[R]} position={[0,-R,0]}/><CylinderCollider args={[.17,PAD_RADIUS]} position={[0,-.17,0]}/></RigidBody>
    <Ecctrl ref={player} position={spawn} enable={mode==='normal'} enableCustomGravity useCustomForward canSleep={false} maxWalkVel={speed} jumpVel={2.4} fallingGravityScale={1}/></>;
}

// Ecctrl applies impulses once per rendered frame, using world.timestep.
// Advance this one-body world on that same clock on 72/90/120 Hz devices.
export default function PlanetMotor(props:Props){return <Physics gravity={[0,0,0]} timeStep="vary" paused interpolate={false}><Walker {...props}/></Physics>}
