import {memo,useLayoutEffect,useMemo,type RefObject} from 'react';
import {useThree} from '@react-three/fiber';
import {Physics,useRapier} from '@react-three/rapier';
import type {Object3D} from 'three';
import {useMmdVrStore} from '../mmdVrStore';
import {useBackpack} from '../backpack/store';
import {WALK_SPEED} from '../settings/mmdVrQuality';
import {actorBodies} from './actorBodies';
import type {PlanetDriver} from './planetTravel';
import {createHomeCapsule} from './homeCapsule';
import {addHomeTerrainSolids} from './homeTerrainSolids';
import {createPlanetPropSolids} from './planetPropSolids';
type Props={driver:RefObject<PlanetDriver|null>};

// Only mounted for this sphere. Static GLB surfaces must stay hollow; PMX
// occupancies use the same narrow torso proxies as the planar motor.
function ActorSolid({x,z,r,bottom,top}:ReturnType<typeof actorBodies>[number]){
  const {rapier,world}=useRapier();
  useLayoutEffect(()=>{
    if(!(top>bottom&&r>0))return;
    const fixed=world.createRigidBody(rapier.RigidBodyDesc.fixed());
    world.createCollider(rapier.ColliderDesc.cylinder((top-bottom)/2,r).setTranslation(x,(top+bottom)/2,z),fixed);
    return ()=>{if(fixed.isValid())world.removeRigidBody(fixed)};
  },[rapier,world,x,z,r,bottom,top]);return null;
}

function PropSolid({root}: {root:Object3D}){
  const {rapier,world}=useRapier();
  const solids=useMemo(()=>createPlanetPropSolids(rapier,world,root),[rapier,world,root]);
  useLayoutEffect(()=>solids.dispose,[solids]);
  useLayoutEffect(()=>{solids.update()});
  return null;
}

const LandingSolids=memo(function LandingSolids(){
  const scene=useThree(s=>s.scene),live=useBackpack(s=>s.live);
  return <>
    {actorBodies(useBackpack.getState().entries,live).map(b=><ActorSolid key={b.id} {...b}/>)}
    {scene.children.filter(o=>o.visible&&o.userData.stagePropSolid).map(o=><PropSolid key={o.id} root={o}/>)}
  </>;
});

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
