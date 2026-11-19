import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Group, Mesh, Vector3 } from 'three';
import { noPick } from '../../scenery/sceneryPaint';
import { makeBoat, makeGate, makeRing, makeWake } from './ferryModels';
import { advanceFerry, boatPose, boatSize, GATE_X, GATE_Y, GATE_Z, ringPose, sideSign } from './voyage';

const forward = new Vector3(0,0,1);

/** Mount once, at the world root, while viewing the pool. All commands share one finite voyage. */
export function FerryStation() {
  const models=useMemo(()=>({left:makeGate('left'),right:makeGate('right'),boat:makeBoat(),wake:makeWake(),ring:makeRing()}),[]);
  const boat=useRef<Group>(null), ring=useRef<Mesh>(null);
  useLayoutEffect(()=>()=>{for(const g of Object.values(models))g.dispose();},[models]);
  useFrame((_,delta)=>{
    const ferry=boat.current, film=ring.current;
    if (!ferry || !film) return;
    const v=advanceFerry(delta);
    if (!v) {ferry.visible=false;film.visible=false;return;}
    const swell=ringPose(v,film.position);
    film.visible=swell>0;
    if(film.visible) {film.scale.setScalar(swell);film.quaternion.setFromUnitVectors(forward,v.ray);}
    const size=boatSize(v);
    ferry.visible=size>0;
    if(ferry.visible) {
      ferry.rotation.y=boatPose(v,ferry.position);ferry.scale.setScalar(size);
      ferry.userData.departure=v.side;
    }
  });
  return <group name="play:ferry-station" pointerEvents="none">
    {(['left','right'] as const).map(side=><mesh key={side} name={`ferry:gate:${side}`} geometry={models[side]}
      position={[sideSign(side)*GATE_X,GATE_Y,GATE_Z]} raycast={noPick}><meshStandardMaterial vertexColors roughness={.68}/></mesh>)}
    <mesh name="ferry:ring" ref={ring} geometry={models.ring} visible={false} raycast={noPick}>
      <meshBasicMaterial vertexColors transparent opacity={.88} depthWrite={false} toneMapped={false}/>
    </mesh>
    <group name="ferry:boat" ref={boat} visible={false}>
      <mesh name="ferry:launch" geometry={models.boat} raycast={noPick}>
        <meshStandardMaterial vertexColors roughness={.72} side={DoubleSide}/>
      </mesh>
      <mesh name="ferry:wake" geometry={models.wake} raycast={noPick}>
        <meshBasicMaterial vertexColors transparent opacity={.54} depthWrite={false} side={DoubleSide}/>
      </mesh>
    </group>
  </group>;
}
