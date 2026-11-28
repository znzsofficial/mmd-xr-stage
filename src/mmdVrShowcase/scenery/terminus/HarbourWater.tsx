import {useCallback,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BackSide,BufferGeometry,Float32BufferAttribute,RepeatWrapping,type Group,type Mesh,type ShaderMaterial} from 'three';
import {RoomShader} from '../daylightMaterials';
import {noPick} from '../sceneryPaint';
import {useMmdVrStore} from '../../mmdVrStore';
import type {createTideClock} from './tideClock';
import {bindStationTide} from './stationTide';
import {landing,quay,stairs} from './shoreLayout';
import {fishingBoat} from './harbourFixtures';
import {HarbourBoat} from './HarbourBoat';
import {useHarbourSkyUniforms} from './harbourAtmosphere';
import {useBakedSurface} from '../useBakedSurface';
import {harbourHorizon,harbourVertex,harbourWaterFragment,tidalStoneFragment} from './harbourWaterShader';

function tideTreads(){
  const positions:number[]=[];
  for(const s of [landing,...stairs]){
    const x=s.x-s.w/2,a=s.x+s.w/2,z=s.z-s.d/2,b=s.z+s.d/2,y=s.y+.002;
    positions.push(x,y,z,x,y,b,a,y,z,a,y,z,x,y,b,a,y,b);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));return g;
}

// The park used to hide one unbroken water quad. The city's arcade court is
// below flood level: remove inland water from the mesh on both renderers.
export function harbourWaterSurface(){
  const positions:number[]=[];
  function water(left:number,right:number,near:number,far:number){
    positions.push(left,0,near, left,0,far, right,0,far, left,0,near, right,0,far, right,0,near);
  }
  water(-120,120,-120,40);
  water(-120,-65,40,120);
  water(76,120,40,120);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();return geometry;
}

export function HarbourWater({clock}:{clock:ReturnType<typeof createTideClock>}){
  const scene=useThree(s=>s.scene),water=useRef<Mesh>(null),floating=useRef<Group>(null),buoy=useRef<Group>(null);
  const high=useMmdVrStore(s=>s.prefs.renderQuality==='high');
  const tide=useMemo(()=>({phase:{value:0},waterline:{value:clock.level},boatY:{value:clock.level+fishingBoat.draft},localReflections:{value:0}}),[clock]);
  useLayoutEffect(()=>{tide.localReflections.value=Number(high);},[high,tide]);
  const slopes=useBakedSurface('/scenery/terminus/harbour-slopes.webp','data');
  useLayoutEffect(()=>{
    if(slopes){slopes.wrapS=slopes.wrapT=RepeatWrapping;slopes.needsUpdate=true;}
  },[slopes]);
  const sky=useHarbourSkyUniforms('reflection');
  const u=useMemo(()=>({...sky,...tide,harbourSlopes:{value:slopes},slopesReady:{value:Number(!!slopes)}}),[sky,tide,slopes]);
  // Fiber copies ShaderMaterial uniform cells when applying JSX props. Keep
  // the tide, light and phase cells live after that copy, as on the TSL path.
  const bindUniforms=useCallback((m:ShaderMaterial)=>{if(m.isShaderMaterial)m.uniforms=u;},[u]);
  const treads=useMemo(tideTreads,[]);useLayoutEffect(()=>()=>treads.dispose(),[treads]);
  const sea=useMemo(harbourWaterSurface,[]);useLayoutEffect(()=>()=>sea.dispose(),[sea]);
  useLayoutEffect(()=>bindStationTide(scene,clock),[scene,clock]);
  useFrame((_,dt)=>{
    const level=clock.step(dt);
    tide.waterline.value=level;tide.phase.value=(tide.phase.value+Math.min(.1,dt)*.71)%(Math.PI*200);
    if(water.current)water.current.position.y=level;
    if(buoy.current)buoy.current.position.y=level;
    tide.boatY.value=level+fishingBoat.draft+.032*Math.sin(tide.phase.value);
    if(floating.current){floating.current.position.y=tide.boatY.value;floating.current.rotation.z=.003*Math.sin(tide.phase.value*.62);}
  });
  return <><mesh name="terminus:sea-horizon" renderOrder={-90} frustumCulled={false} raycast={noPick} userData={{playerCollision:false}}><sphereGeometry args={[1,32,10,0,2*Math.PI,Math.PI/2,Math.PI/2]}/>
    <RoomShader effect="harbourHorizon" side={BackSide} depthTest={false} depthWrite={false} toneMapped={false} uniforms={u} onUpdate={bindUniforms}
      vertexShader={`varying vec3 skyDir;void main(){skyDir=position;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(clip.xy,0.,clip.w);}`}
       fragmentShader={harbourHorizon}/></mesh>
   {/* Opaque water: let nearer buildings, actors and the quay fill depth before shading the waves. */}
    <mesh name="terminus:sea" geometry={sea} renderOrder={20} ref={water} position={[0,clock.level,0]} raycast={noPick} userData={{playerCollision:false}}>
     <RoomShader effect="harbourWater" vertexShader={harbourVertex} fragmentShader={harbourWaterFragment} uniforms={u} onUpdate={bindUniforms} toneMapped={false}/>
  </mesh><mesh name="terminus:tidal-stone" geometry={treads} raycast={noPick} userData={{playerCollision:false}}>
    <RoomShader effect="tidalStone" vertexShader={harbourVertex} fragmentShader={tidalStoneFragment} uniforms={u} onUpdate={bindUniforms} toneMapped={false}/>
  </mesh><mesh name="terminus:tidemark" position={[quay.x,-.72,quay.z-quay.d/2-.027]} rotation-y={Math.PI} raycast={noPick} userData={{playerCollision:false}}>
    <planeGeometry args={[quay.w,1.12]}/><RoomShader effect="quaySalt" vertexShader={harbourVertex} uniforms={u} onUpdate={bindUniforms}
      fragmentShader={`varying vec3 harbourP;uniform float waterline;
      void main(){float row=floor(harbourP.y*6.);vec2 p=vec2(harbourP.x*1.16+row*.49,harbourP.y*6.);
      vec2 edge=abs(fract(p)-.5);float seam=smoothstep(.458,.50,max(edge.x,edge.y));float chip=fract(sin(dot(floor(p),vec2(13.1,74.9)))*715.133);
      float wet=1.-smoothstep(waterline+.03,waterline+.18,harbourP.y+.035*sin(p.x*4.));
      vec3 c=mix(vec3(.36,.37,.31),vec3(.11,.20,.16),wet)*(.88+.19*chip)*(1.-seam*.23);gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`}/></mesh>
  <group ref={floating} position={[fishingBoat.x,clock.level+fishingBoat.draft,fishingBoat.z]} rotation-y={fishingBoat.yaw} pointerEvents="none"><HarbourBoat/></group>
  <group ref={buoy} position-y={clock.level} pointerEvents="none"><mesh position={[8.4,.08,-18.8]} scale={[1,1.32,1]} userData={{playerCollision:false}}><sphereGeometry args={[.19,16,12]}/><meshStandardMaterial color="#c47649"/></mesh>
    <mesh position={[8.4,.21,-18.8]} userData={{playerCollision:false}}><cylinderGeometry args={[.13,.18,.055,16]}/><meshStandardMaterial color="#f2dfae"/></mesh></group></>;
}
