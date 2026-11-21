import {useEffect,useMemo} from 'react';
import {DoubleSide,ShaderChunk,type MeshStandardMaterial} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import {arcadePaint} from './paintedShell';
import {upperFrontZ,lowerFrontZ} from './arcadeLayout';
import color from './hall-surfaces.webp';
import finish from './hall-finishes.webp';
import lettering from './hall-lettering.webp';
import vine from './hall-ivy.webp';

const noPick=()=>null,noBody={playerCollision:false};
// One data atlas: RG tangent normal, B roughness (not the standard ORM layout).
const hallFinish:MeshStandardMaterial['onBeforeCompile']=shader=>{
  shader.vertexShader='varying vec3 arcLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\narcLocal = position;');
  shader.fragmentShader='varying vec3 arcLocal;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 a=arcLocal.xz;float front=mix(${lowerFrontZ.toFixed(3)},${upperFrontZ.toFixed(3)},step(3.2,arcLocal.y));float hall=(1.-smoothstep(6.93,7.03,abs(a.x)))*(1.-smoothstep(-.10,.02,max(a.y-front,-4.5-a.y)));
    float level=step(3.2,arcLocal.y), foot=abs(arcLocal.y-level*3.4);
    float ground=1.-smoothstep(.03,.77,foot);
    vec2 col=max(vec2(0.),abs(vec2(abs(a.x)-2.24,a.y-1.94))-vec2(.52,.54));
    vec2 signFoot=max(vec2(0.),abs(vec2(a.x,a.y+1.67))-vec2(3.28,.13));
    float contact=max((1.-level)*.25*exp(-dot(col,col)*6.0),.20*exp(-dot(signFoot,signFoot)*5.));
    float walls=min(7.-abs(a.x),min(front-a.y,4.5+a.y));contact=max(contact,.19*exp(-max(0.,walls)*3.));
    float shade=(1.-ground)*(.08+.16*(1.-smoothstep(.0,.95,walls)));
    diffuseColor.rgb*=1.-hall*(ground*contact+shade);
    // Contact colour under the west decks, including when real shadows are
    // off on Quest. Fade it out at each open end and below the upper walk.
    float aisle=smoothstep(7.0,7.42,a.x)*(1.-smoothstep(10.96,11.24,a.x))*smoothstep(-4.6,-3.5,a.y)*(1.-smoothstep(5.15,6.65,a.y));
    float caseLane=smoothstep(11.18,11.68,a.x)*(1.-smoothstep(13.83,14.06,a.x))*smoothstep(-4.5,-3.45,a.y)*(1.-smoothstep(3.05,4.42,a.y));
    float under=1.-smoothstep(3.18,3.38,arcLocal.y);
    diffuseColor.rgb*=vec3(1.)-under*(aisle*vec3(.19,.23,.23)+caseLane*vec3(.30,.23,.17));
    float wallFoot=min(abs(a.x-7.15),abs(a.x-10.98));
    vec2 bench=max(abs(a-vec2(10.67,4.0))-vec2(.27,.99),vec2(0.));
    diffuseColor.rgb*=1.-aisle*(1.-smoothstep(.03,.43,arcLocal.y))*max(.26*(1.-smoothstep(.04,.58,wallFoot)),.34*(1.-smoothstep(.02,.72,length(bench))));
    #if NUM_DIR_LIGHT_SHADOWS == 0
      vec2 shaft=abs(a-vec2(1.35,-.45));float day=(1.-smoothstep(2.38,2.82,shaft.x))*(1.-smoothstep(1.06,1.42,shaft.y));
      diffuseColor.rgb*=1.+hall*ground*(.05+day*.27);
    #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#define USE_PACKED_NORMALMAP\n'+ShaderChunk.normal_fragment_maps+'\n#undef USE_PACKED_NORMALMAP')
    .replace('#include <roughnessmap_fragment>',ShaderChunk.roughnessmap_fragment.replace('texelRoughness.g','texelRoughness.b'));
};
export function ArcadePrints(){
  const p=useMemo(arcadePaint,[]),base=useBakedSurface(color),data=useBakedSurface(finish,'data'),type=useBakedSurface(lettering),ivy=useBakedSurface(vine);
  useEffect(()=>()=>{Object.values(p).forEach(g=>g.dispose());},[p]);
  return <group name="arcade:print-finish" pointerEvents="none">
    {base&&data&&<mesh name="arcade:enamel" geometry={p.room} userData={noBody} raycast={noPick} receiveShadow><meshStandardMaterial map={base} normalMap={data} normalScale={[.57,.57]} roughnessMap={data} vertexColors onBeforeCompile={hallFinish}/></mesh>}
    {type&&<><mesh name="arcade:letterpress" geometry={p.posters} userData={noBody} raycast={noPick}><meshStandardMaterial map={type} roughness={.68}/></mesh>
      <mesh name="arcade:crt" geometry={p.screens} userData={noBody} raycast={noPick}><meshBasicMaterial map={type} toneMapped={false}/></mesh></>}
    {ivy&&<mesh name="arcade:ivy" geometry={p.leaves} userData={noBody} raycast={noPick}><meshStandardMaterial map={ivy} alphaTest={.48} alphaToCoverage side={DoubleSide} roughness={.96}/></mesh>}
  </group>;
}
