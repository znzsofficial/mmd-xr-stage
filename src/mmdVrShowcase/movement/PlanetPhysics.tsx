import {useLayoutEffect,type RefObject} from 'react';
import {useThree} from '@react-three/fiber';
import {Physics,useRapier} from '@react-three/rapier';
import {Matrix4,Vector3,type InstancedMesh} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {useBackpack} from '../backpack/store';
import {WALK_SPEED} from '../settings/mmdVrQuality';
import {actorBodies} from './actorBodies';
import type {PlanetDriver} from './planetTravel';
import {createHomeCapsule} from './homeCapsule';
import {addHomeTerrainSolids} from './homeTerrainSolids';
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
  const {world,rapier}=useRapier();
  useLayoutEffect(()=>{
    const terrain=addHomeTerrainSolids(rapier,world);
    const d=createHomeCapsule(rapier,world,()=>{const pref=useMmdVrStore.getState().prefs.walkSpeedPref;return WALK_SPEED[pref==='auto'?'normal':pref];});
    driver.current=d;return()=>{if(driver.current===d)driver.current=null;d.dispose();if(terrain.isValid())world.removeRigidBody(terrain);};
  },[driver,rapier,world]);
  return <LandingSolids/>;
}

// Only PlanetMotor's grounded owner advances this world, on its XR clock.
export default function PlanetPhysics(props:Props){return <Physics gravity={[0,0,0]} timeStep="vary" paused interpolate={false}><Walker {...props}/></Physics>}
