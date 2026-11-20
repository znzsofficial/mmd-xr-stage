import type { MeshStandardMaterial } from 'three';
import { ROOM } from './ClassroomLayout';
import { classroomBounce, classroomSunlight } from './ClassroomLight';

type Shader=Parameters<MeshStandardMaterial['onBeforeCompile']>[0];
type Stock='board'|'back'|'tube';

// Only furniture sees this soft sky reflection. Trace its reflected view ray
// to the open window wall, broadening the opening by the material's lobe.
// Never put this in the room light: the actor, parquet and paper are matte.
const reflectedWindow=`{
  vec3 sight=normalize(vViewPosition);
  vec3 direction=inverseTransformDirection(reflect(-sight,normal),viewMatrix);
  float travel=(vClassPosition.x+${ROOM.w/2})/max(.04,-direction.x);
  vec2 hit=vClassPosition.yz+direction.yz*travel;
  float blur=.065+roughnessFactor*roughnessFactor*(1.+travel*.68);
  float opening=smoothstep(${ROOM.sill}-blur,${ROOM.sill}+blur,hit.x)
    *(1.-smoothstep(${ROOM.lintel}-blur,${ROOM.lintel}+blur,hit.x))
    *(1.-smoothstep(${ROOM.d/2}-blur,${ROOM.d/2}+blur,abs(hit.y)));
  float fresnel=.038+.68*pow(1.-max(0.,dot(sight,normal)),5.);
  float sash=abs(fract((hit.y+${ROOM.d/2})/${ROOM.d/ROOM.bays})-.5);
  float panes=1.-.40*smoothstep(.41,.49,sash)*(1.-smoothstep(.15,.75,blur));
  reflectedLight.indirectSpecular+=vec3(.83,.93,1.)*opening*panes*fresnel
    *smoothstep(.04,.38,-direction.x)*(1.-roughnessFactor*.85)*1.25;
}`;

function furniture(s:Shader,project:boolean,stock:Stock){
  (project?classroomSunlight:classroomBounce)(s);
  let varnish='';
  if(stock!=='tube'){
    const vars='varying vec2 vStockUv; varying vec3 vStockT; varying vec3 vPolish; varying vec2 vPanel;';
    s.vertexShader=`attribute float classCut; ${vars}\n`+s.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec3 scaleM=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      vec2 metres; vec3 axis=vec3(1.,0.,0.);
      ${stock==='board'?`
        metres=position.xz*scaleM.xz*vec2(1.,-1.);
        vPanel=position.xz;
        if(classCut>.5){
          metres=vec2(classCut>1.5?position.z*scaleM.z:position.x*scaleM.x,position.y*scaleM.y);
          axis=classCut>1.5?vec3(0.,0.,1.):axis;
        }
      `:`
        metres=(uv-.5)*vec2(.44,.192);
        vPanel=uv-.5;
        if(classCut>.5) metres.y=position.z-.191-metres.y*.17+position.x*position.x*.55;
      `}
      // Different rotary cut on each board; actual fibre/pore size is constant.
      float plank=float(gl_InstanceID);vStockUv=metres/vec2(.96,.48)+vec2(plank*.317,plank*.139);
      vStockT=mat3(modelViewMatrix)*mat3(instanceMatrix)*axis;
      vPolish=vec3(step(.6,scaleM.x),step(.5,classCut),metres.y);
    `);
    s.fragmentShader=vars+'\n'+s.fragmentShader.replace('#include <map_fragment>',`
      vec3 fibre=vec3(.93,.5,.5);
      #ifdef USE_MAP
        fibre=texture2D(map,vStockUv).rgb;
      #endif
      float edging=vPolish.y;
      float ply=cos(vPolish.z*1450.)*(1.-smoothstep(.001,.003,fwidth(vPolish.z)));
      diffuseColor.rgb*=mix(vec3(fibre.r),vec3(.77,.72,.68)*(.94+.07*ply),edging);
    `).replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec3 along=vStockT-normal*dot(vStockT,normal);
      along*=inversesqrt(max(dot(along,along),.00001));
      vec2 poreSlope=(fibre.gb-.5)*(.14-.055*wear)*(1.-edging*.86);
      normal=normalize(normal+along*poreSlope.x+cross(normal,along)*poreSlope.y);
    `);
    // Interpolate coordinates, not the wear field: the board cap consists of
    // large triangles across the entire panel.
    const wear=stock==='board'?`(vPolish.x>.5 ? 1.-smoothstep(.08,1.,dot(arm,arm)) : 1.-smoothstep(.04,.26,dot(vPanel,vPanel)))`:
      `(1.-smoothstep(.08,1.,length((vPanel-vec2(0.,.35))*vec2(3.8,3.))))`;
    varnish=`vec2 arm=(vec2(abs(vPanel.x)-.26,vPanel.y-.30))*vec2(3.2,4.3);
      float wear=${wear};
      roughnessFactor=mix(.52-wear*.18,.43,edging);`;
  }else{
    // Opaque powder coat is dielectric, not exposed chrome. Rubber boot rings
    // share its batch and geometry but retain a much broader highlight.
    s.vertexShader='varying float vBoot;\n'+s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoot=1.-smoothstep(.03,.033,position.y);');
    s.fragmentShader='varying float vBoot;\n'+s.fragmentShader;
    varnish='roughnessFactor=mix(.34,.78,vBoot);';
  }
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+varnish)
    .replace('#include <aomap_fragment>', reflectedWindow+'\n#include <aomap_fragment>');
}

// Different source strings are intentional: Three keys Batch's material
// programs on the compile callback (not on the values captured in closures).
export const boardDay=(s:Shader)=>furniture(s,true,'board');
export const boardShadow=(s:Shader)=>furniture(s,false,'board');
export const backDay=(s:Shader)=>furniture(s,true,'back');
export const backShadow=(s:Shader)=>furniture(s,false,'back');
export const steelDay=(s:Shader)=>furniture(s,true,'tube');
export const steelShadow=(s:Shader)=>furniture(s,false,'tube');

export function parquetContact(s:Shader){
  classroomBounce(s);
  s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',`
    float contact=diffuseColor.a;
    reflectedLight.indirectDiffuse*=contact;
    #include <aomap_fragment>`);
}
