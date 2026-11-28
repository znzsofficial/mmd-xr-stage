import {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color, DoubleSide, InstancedMesh, RepeatWrapping, type BufferGeometry, type Texture} from 'three';
import {cameraInstancePrefix} from '../../cameraInstancePrefix';
import {noPick} from '../../sceneryPaint';
import {useBakedSurface} from '../../useBakedSurface';
import {SHORE_SUN} from '../shoreLayout';
import {growTree, habitCount, sprayPoints, sprayTiles, type ParkTree} from './treeHabit';
import {barkGeometry, sprayGeometry, treeBatches, type TreeInstance} from './treeSurfaces';
import {ParkLeafShade} from './ParkLeafShade';
import barkUrl from './zelkova-bark.webp';
import leavesUrl from './zelkova-sprays.webp';

type Props = {trees:readonly ParkTree[]; shadows:boolean};

function TreeBatch({name, geometry, instances, shadows, map, crownEnds}:{
  name:string; geometry:BufferGeometry; instances:TreeInstance[]; shadows:boolean; map:Texture|null; crownEnds?:number[];
}){
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    const mesh=ref.current!, shade=new Color('#92a6a5'), sun=new Color('#ffe8ad'), ink=new Color();
    for(const [i,{matrix,exposure}] of instances.entries()){
      mesh.setMatrixAt(i,matrix);
      if(exposure!==undefined)mesh.setColorAt(i,ink.lerpColors(shade,sun,exposure));
    }
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
    if(crownEnds)return cameraInstancePrefix(mesh,crownEnds,.45);
  },[geometry,instances,crownEnds]);
  return <instancedMesh ref={ref} name={name} args={[geometry,undefined,instances.length]} raycast={noPick}
    castShadow={shadows} receiveShadow userData={{playerCollision:!crownEnds}}>
    {crownEnds ? <meshStandardMaterial map={map} alphaTest={.36} side={DoubleSide} roughness={.76}
      emissive="#779332" emissiveMap={map} emissiveIntensity={.32}/> :
      <meshStandardMaterial key={map?'bark':'bare'} map={map} color={map?'white':'#817868'} roughness={.90}/>}
  </instancedMesh>;
}

export function ParkTrees({trees,shadows}:Props){
  const map=useBakedSurface(leavesUrl), bark=useBakedSurface(barkUrl);
  const habits=useMemo(()=>Array.from({length:habitCount},(_,i)=>growTree(i,SHORE_SUN)),[]);
  const wood=useMemo(()=>habits.map(barkGeometry),[habits]);
  const blades=useMemo(()=>Array.from({length:sprayTiles},(_,i)=>sprayGeometry(i)),[]);
  useEffect(()=>()=>{for(const g of [...wood,...blades])g.dispose();},[wood,blades]);
  useLayoutEffect(()=>{if(bark){bark.wrapS=bark.wrapT=RepeatWrapping; bark.needsUpdate=true;}},[bark]);
  const {trunks,sprays,crownEnds}=useMemo(()=>treeBatches(trees,habits),[trees,habits]);
  const time=useRef(0);
  useFrame((_,delta)=>{
    if(!map)return;
    time.current+=Math.min(delta,.10);
    for(const [i,g] of blades.entries()){
      // Four small shared vertex buffers flutter; every petiole stays on its
      // twig. No per-tree uploads, material patches or separate shadow pose.
      const t=time.current, wave=.024*Math.sin(t*1.28+i*1.75)+.011*Math.sin(t*3.3+i*.89);
      const p=g.attributes.position;
      for(let j=3;j<p.count;j++){
        const x=sprayPoints[j*3], along=sprayPoints[j*3+1];
        p.setZ(j,sprayPoints[j*3+2]+wave*along*along*(1+.63*x));
      }
      p.needsUpdate=true;
    }
  });
  return <group name="park:boulevard-trees">
    {wood.map((g,i)=>trunks[i].length>0&&<TreeBatch key={`wood-${i}`} name={`park:zelkova-wood-${i}`} geometry={g}
      instances={trunks[i]} shadows={shadows} map={bark}/>)}
    {map&&<group name="terminus:park-leaves">{blades.map((g,i)=>sprays[i].length>0&&<TreeBatch key={`leaves-${i}`} name={`park:zelkova-leaves-${i}`} geometry={g}
      instances={sprays[i]} shadows={shadows} map={map} crownEnds={crownEnds[i]}/>)}</group>}
    {!shadows&&trees.length>0&&<ParkLeafShade trees={trees}/>}
  </group>;
}
