import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CubeTextureLoader, DynamicDrawUsage, MixOperation, Object3D, RepeatWrapping, Sphere, Vector3,
  type CubeTexture, type InstancedMesh, type Mesh,
} from 'three';
import { noPick } from '../../sceneryPaint';
import { useBakedSurface } from '../../useBakedSurface';
import mineral from '../../retreat/mineral.webp';
import { HarbourLight } from '../harbourAtmosphere';
import { fountainMetal, fountainStone, fountainStreams } from './fountainGeometry';
import { dropCount, fountainSurface, setDropPose, setWavePhase } from './fountainWater';

const probeFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(side => `/scenery/terminus/fountain-${side}.webp`);
const waterOnly = { playerCollision: false };

function useFountainReflection() {
  const [probe, setProbe] = useState<CubeTexture | null>(null);
  useEffect(() => {
    let mounted = true;
    const texture = new CubeTextureLoader().load(probeFaces, ready => { if (mounted) setProbe(ready); });
    return () => { mounted = false; texture.dispose(); };
  }, []);
  return probe;
}

export function ParkFountain({ shadows }: { shadows: boolean }) {
  const geometry = useMemo(() => ({ stone: fountainStone(), bronze: fountainMetal(), surface: fountainSurface(), streams: fountainStreams() }), []);
  useEffect(() => () => Object.values(geometry).forEach(g => g.dispose()), [geometry]);
  const print = useBakedSurface(mineral);
  useLayoutEffect(() => {
    if (print) { print.wrapS = print.wrapT = RepeatWrapping; print.needsUpdate = true; }
  }, [print]);
  const probe = useFountainReflection();
  const reflection = useContext(HarbourLight)?.skyEnabled === false ? null : probe;
  const surface = useRef<Mesh>(null), jets = useRef<Mesh>(null), spray = useRef<InstancedMesh>(null);
  const pose = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (spray.current) {
      spray.current.instanceMatrix.setUsage(DynamicDrawUsage);
      spray.current.boundingSphere = new Sphere(new Vector3(0, 1, 0), 2.4);
    }
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const surfaceWeights = surface.current?.morphTargetInfluences, streamWeights = jets.current?.morphTargetInfluences;
    if (surfaceWeights) setWavePhase(surfaceWeights, t);
    if (streamWeights) { streamWeights[0] = Math.cos(25 * t); streamWeights[1] = -Math.sin(25 * t); }
    if (spray.current) {
      for (let i = 0; i < dropCount; i++) {
        setDropPose(pose, i, t);
        spray.current.setMatrixAt(i, pose.matrix);
      }
      spray.current.instanceMatrix.needsUpdate = true;
    }
  });

  return <group name="terminus:park-fountain" pointerEvents="none">
    <mesh name="terminus:fountain-stone" geometry={geometry.stone} raycast={noPick} castShadow={shadows} receiveShadow={shadows}>
      <meshStandardMaterial key={print?.uuid} vertexColors map={print} roughness={.72}/>
    </mesh>
    <mesh name="terminus:fountain-bronze" geometry={geometry.bronze} raycast={noPick} castShadow={shadows} receiveShadow={shadows}>
      <meshStandardMaterial vertexColors roughness={.33} metalness={.42}/>
    </mesh>
    <mesh name="terminus:fountain-water" ref={surface} args={[geometry.surface]} raycast={noPick} userData={waterOnly} receiveShadow={shadows}>
      <meshPhongMaterial key={reflection?.uuid} color="#397b7a" specular="#a8c3c2" shininess={115} envMap={reflection}
        combine={MixOperation} reflectivity={.48} transparent opacity={.67} depthWrite={false}/>
    </mesh>
    <mesh name="terminus:fountain-jets" ref={jets} args={[geometry.streams]} raycast={noPick} userData={waterOnly}>
      <meshPhongMaterial key={reflection?.uuid} vertexColors specular="#e5f0eb" shininess={85} envMap={reflection}
        combine={MixOperation} reflectivity={.43} transparent opacity={.70} depthWrite={false}/>
    </mesh>
    <instancedMesh name="terminus:fountain-spray" ref={spray} args={[undefined, undefined, dropCount]} raycast={noPick} userData={waterOnly}>
      <icosahedronGeometry args={[1, 0]}/>
      <meshStandardMaterial color="#d5e6df" roughness={.24} transparent opacity={.80} depthWrite={false}/>
    </instancedMesh>
  </group>;
}
