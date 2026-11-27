import {useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BackSide,BufferGeometry,DoubleSide,Float32BufferAttribute,type Group,type Mesh} from 'three';
import {RoomShader} from '../daylightMaterials';
import {noPick} from '../sceneryPaint';
import type {createTideClock} from './tideClock';
import {bindStationTide} from './stationTide';
import {quay} from './shoreLayout';

const vertex=`varying vec3 harbourP;void main(){vec4 w=modelMatrix*vec4(position,1.);harbourP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const fragment=`varying vec3 harbourP;uniform float phase;
float swell(vec2 p){return sin(p.y*3.2+p.x*.8+.72*sin(p.x*1.17+phase*.4)+phase)+.48*sin(p.x*2.6-p.y*5.5+1.2*sin(p.y*.75)-phase*1.3);}
void main(){vec2 p=harbourP.xz;vec3 v=cameraPosition-harbourP;float dist=length(v);v=normalize(v);
  float nearby=1.-smoothstep(12.,38.,dist);float s=swell(p);float wind=sin(p.y*15.3+p.x*2.9+2.1*s+phase*1.8);
  float slope=clamp(s*.52+wind*.18*nearby,-1.,1.);float fres=pow(1.-abs(v.y),4.);
  vec3 c=mix(vec3(.025,.161,.184),vec3(.17,.39,.38),slope*.34+.48);
  vec2 wide=p*vec2(.29,.36);float fetchWave=sin(wide.x+1.1*sin(wide.y+.065*phase))*.48+.52;
  c=mix(c,vec3(.42,.58,.61),(.48+.20*fetchWave)*fres);float glitter=smoothstep(.68,1.,slope)*smoothstep(.26,1.,wind)*nearby;
  c+=vec3(.36,.29,.18)*glitter*(.12+.88*fetchWave);float wake=sin(p.y*7.4+p.x*1.6+.95*s-phase*.69);
  c+=vec3(.11,.17,.15)*smoothstep(.84,1.,wake)*smoothstep(.42,1.25,s)*nearby;
  c=mix(c,vec3(.35,.51,.55),smoothstep(27.,46.,dist));
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;

function hull(){const p:number[]=[],ix:number[]=[];
  for(const [z,w,rise] of [[-1.94,.035,.25],[-1.14,.65,.11],[.48,.73,.08],[1.55,.55,.16]]){
    for(const [x,y] of [[-w,rise],[-w*.72,-.23],[0,-.38],[w*.72,-.23],[w,rise]])p.push(x,y,z);
  }for(let j=0;j<3;j++)for(let i=0;i<4;i++){const a=j*5+i;ix.push(a,a+1,a+5,a+5,a+1,a+6);}
  ix.push(15,16,19,16,18,19,16,17,18);const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
function Boat(){const g=useMemo(hull,[]);useLayoutEffect(()=>()=>g.dispose(),[g]);return <group position={[9,.22,-24.2]} rotation-y={1.01}>
  <mesh geometry={g} raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial color="#38645f" side={DoubleSide}/></mesh>
  <mesh position={[0,.08,.17]} scale={[1,.31,2.28]}><sphereGeometry args={[.64,16,10]}/><meshStandardMaterial color="#c4aa7c"/></mesh>
  <mesh position={[0,.36,.53]}><boxGeometry args={[.92,.51,.86]}/><meshStandardMaterial color="#d5d3b8"/></mesh>
  <mesh position={[0,.49,.529]}><boxGeometry args={[.935,.165,.875]}/><meshStandardMaterial color="#4f6b6a"/></mesh>
  <mesh position={[0,.646,.52]}><boxGeometry args={[1.08,.075,1.03]}/><meshStandardMaterial color="#a15f45"/></mesh>
  <mesh position={[0,.98,-.43]}><cylinderGeometry args={[.025,.039,1.68,8]}/><meshStandardMaterial color="#8a7655"/></mesh>
</group>;}
export function HarbourWater({clock}:{clock:ReturnType<typeof createTideClock>}){
  const scene=useThree(s=>s.scene),water=useRef<Mesh>(null),floating=useRef<Group>(null),buoy=useRef<Group>(null);
  const u=useMemo(()=>({phase:{value:0},waterline:{value:clock.level}}),[clock]);
  useLayoutEffect(()=>bindStationTide(scene,clock),[scene,clock]);
  useFrame((_,dt)=>{const level=clock.step(dt);u.waterline.value=level;u.phase.value=(u.phase.value+Math.min(.1,dt)*.71)%(Math.PI*200);
    if(water.current)water.current.position.y=level;if(buoy.current)buoy.current.position.y=level;
    if(floating.current){floating.current.position.y=level+.032*Math.sin(u.phase.value);floating.current.rotation.z=.003*Math.sin(u.phase.value*.62);}});
  return <><mesh name="terminus:sea-horizon" renderOrder={-90} frustumCulled={false} raycast={noPick} userData={{playerCollision:false}}><sphereGeometry args={[1,32,20]}/>
    <RoomShader effect="harbourHorizon" side={BackSide} depthTest={false} depthWrite={false} toneMapped={false}
      vertexShader={`varying vec3 skyDir;void main(){skyDir=position;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(clip.xy,0.,clip.w);}`}
      fragmentShader={`varying vec3 skyDir;void main(){float h=normalize(skyDir).y;if(h>-.002)discard;
        vec3 c=mix(vec3(.35,.51,.55),vec3(.52,.63,.64),smoothstep(-.012,-.002,h));gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`}/></mesh><mesh name="terminus:sea" ref={water} position={[0,clock.level,0]} rotation-x={-Math.PI/2} raycast={noPick} userData={{playerCollision:false}}>
    <planeGeometry args={[240,240]}/><RoomShader effect="harbourWater" vertexShader={vertex} fragmentShader={fragment} uniforms={u} toneMapped={false}/>
  </mesh><mesh name="terminus:tidemark" position={[quay.x,-.72,quay.z-quay.d/2-.027]} rotation-y={Math.PI} raycast={noPick} userData={{playerCollision:false}}>
    <planeGeometry args={[quay.w,1.12]}/><RoomShader effect="quaySalt" vertexShader={vertex} uniforms={u}
      fragmentShader={`varying vec3 harbourP;uniform float waterline;
      void main(){float row=floor(harbourP.y*6.);vec2 p=vec2(harbourP.x*1.16+row*.49,harbourP.y*6.);
      vec2 edge=abs(fract(p)-.5);float seam=smoothstep(.458,.50,max(edge.x,edge.y));float chip=fract(sin(dot(floor(p),vec2(13.1,74.9)))*715.133);
      float wet=1.-smoothstep(waterline+.03,waterline+.18,harbourP.y+.035*sin(p.x*4.));
      vec3 c=mix(vec3(.36,.37,.31),vec3(.11,.20,.16),wet)*(.88+.19*chip)*(1.-seam*.23);gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`}/></mesh>
  <group ref={floating} position-y={clock.level} pointerEvents="none"><Boat/></group>
  <group ref={buoy} position-y={clock.level} pointerEvents="none"><mesh position={[8.4,.08,-18.8]} scale={[1,1.32,1]} userData={{playerCollision:false}}><sphereGeometry args={[.19,16,12]}/><meshStandardMaterial color="#c47649"/></mesh>
    <mesh position={[8.4,.21,-18.8]} userData={{playerCollision:false}}><cylinderGeometry args={[.13,.18,.055,16]}/><meshStandardMaterial color="#f2dfae"/></mesh></group></>;
}
