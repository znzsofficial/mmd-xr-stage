import {useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useThree} from '@react-three/fiber';
import {TrimeshCollider,CylinderCollider,Physics,RigidBody,useRapier} from '@react-three/rapier';
import {Ecctrl,type EcctrlHandle} from 'ecctrl';
import {useCustomGravity} from 'ecctrl/gravity';
import {Matrix4,Vector3,type InstancedMesh} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {useBackpack} from '../backpack';
import {WALK_SPEED} from '../mmdVrQuality';
import {actorBodies} from './actorBodies';
import {PAD_RADIUS,PLANET_RADIUS as R} from '../scenery/planet/planetLayout';
import {makeCrust,stations} from '../scenery/planet/opalTerrain';

import {planetCentre as centre,bodyAboveFoot,transport,type PlanetDriver} from './planetTravel';
import {headMargin} from './eyeHeight';
const zero={x:0,y:0,z:0};
const spawn:[number,number,number]=[0,.8,1.9];
type Props={driver:RefObject<PlanetDriver|null>};

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

function Walker({driver}:Props){
  const hull=useMemo(()=>{const g=makeCrust(false),args:[Float32Array,Uint32Array]=[g.attributes.position.array as Float32Array,Uint32Array.from(g.index!.array)];g.dispose();return args;},[]);
  const player=useRef<EcctrlHandle>(null);
  const mode=useMmdVrStore(s=>s.prefs.movementMode),pref=useMmdVrStore(s=>s.prefs.walkSpeedPref),speed=WALK_SPEED[pref==='auto'?'normal':pref];
  const {world,rapier,step}=useRapier();
  useLayoutEffect(()=>{const store=useCustomGravity.getState(),prev=store.gravityField,force=new Vector3();
    store.setGravityField(p=>force.subVectors(centre,p).normalize().multiplyScalar(2.5));return()=>store.setGravityField(prev);
  },[]);
  useLayoutEffect(()=>{
    const at=new Vector3(),radial=new Vector3(),headShape=new rapier.Ball(headMargin);
    const oldFoot=new Vector3(),from=new Vector3(),delta=new Vector3();
    const d:PlanetDriver={
      ready:()=>!!player.current?.body?.isValid(),
      seed(s){const b=player.current!.body!;b.setEnabled(true);
        b.setTranslation(at.copy(s.foot).addScaledVector(s.up,bodyAboveFoot),true);b.setRotation(s.basis,true);
        b.setLinvel(s.velocity,true);b.setAngvel(zero,true);},
      step(s,dt,x,forward,jump,localEye){const c=player.current!,b=c.body!;
        oldFoot.copy(s.foot);from.copy(localEye).applyQuaternion(s.basis).add(oldFoot);
        c.setForwardDir(s.dir);c.setMovement({joystick:{x,y:forward},jump});
        if(dt>0)step(Math.min(1/60,dt)); // Ecctrl applies one impulse per render
        at.copy(b.translation());radial.subVectors(at,centre).normalize();
        s.foot.copy(at).addScaledVector(radial,-bodyAboveFoot);transport(s);
        // The small suspension capsule ends below a standing head. Sweep the
        // calibrated head through virtual travel; real tracked lean remains
        // unmodified and uses the veil. Ignore our own body for both queries.
        delta.copy(localEye).applyQuaternion(s.basis).add(s.foot).sub(from);
        if(delta.lengthSq()>1e-9&&world.castShape(from,s.basis,delta,headShape,0,1,false,undefined,undefined,c.collider,b)){
          s.foot.copy(oldFoot);transport(s);b.setTranslation(at.copy(s.foot).addScaledVector(s.up,bodyAboveFoot),true);b.setLinvel(zero,true);
        }
        s.velocity.copy(b.linvel());s.grounded=c.isOnGround;},
      stop(){const c=player.current;c?.setMovement({joystick:{x:0,y:0},jump:false});c?.body?.setEnabled(false);},
      headBlocked(eye,basis){const c=player.current!;return world.intersectionWithShape(eye,basis,headShape,undefined,undefined,c.collider,c.body)!==null;},
    };
    driver.current=d;return()=>{if(driver.current===d)driver.current=null;};
  },[driver,rapier,step,world]);
  return <><LandingSolids/><RigidBody type="fixed" colliders={false}><TrimeshCollider args={hull} position={[0,-R,0]}/><CylinderCollider args={[.17,PAD_RADIUS]} position={[0,-.17,0]}/>
    {stations.map(s=><group key={s.name} position={s.base} quaternion={s.rotation}><CylinderCollider args={[(s.height+.16)/2,s.r]} position={[0,(s.height-.16)/2,0]}/></group>)}
  </RigidBody>
    <Ecctrl ref={player} position={spawn} enable={mode==='normal'} enableCustomGravity gravityDirLerpSpeed={1000} useCustomForward canSleep={false} maxWalkVel={speed} jumpVel={2.4} fallingGravityScale={1}/></>;
}

// Ecctrl applies impulses once per rendered frame, using world.timestep.
// Advance this one-body world on that same clock on 72/90/120 Hz devices.
export default function PlanetPhysics(props:Props){return <Physics gravity={[0,0,0]} timeStep="vary" paused interpolate={false}><Walker {...props}/></Physics>}
