import type { MeshStandardMaterial } from 'three';
import { WARD } from './clinicLayout';

// Centres of the three frosted lights. Unlike a point light their contribution
// is broad, stays local to the opening, and casts no second fixture shadow.
export const wardWindows = [[WARD.west+.094,.12], [WARD.east-.094,.16], [5.85,WARD.north+.093]] as const;
const [west,east,north]=wardWindows.map(([x,z])=>`length(vWardP.xz-vec2(${x.toFixed(3)},${z.toFixed(3)}))`);
export const wardBounce: MeshStandardMaterial['onBeforeCompile'] = (shader) => {
  shader.vertexShader = 'varying vec3 vWardP;\n' + shader.vertexShader.replace('#include <project_vertex>', `
    vec4 wardLocal=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      wardLocal=instanceMatrix*wardLocal;
    #endif
    vWardP=(modelMatrix*wardLocal).xyz;
    #include <project_vertex>`);
  shader.fragmentShader = 'varying vec3 vWardP;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `
    #include <lights_fragment_end>
    float hall=(1.-smoothstep(1.8,2.38,abs(vWardP.x)))*(.5+.5*cos((vWardP.z+.83)*2.088));
    float windowFill=1.-smoothstep(.3,4.4,min(min(${west},${east}),${north}));
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*(vec3(.11,.12,.126)+hall*vec3(.08,.073,.058)+windowFill*vec3(.15,.185,.21));`);
};

export const nurseFinish: MeshStandardMaterial['onBeforeCompile'] = (shader,renderer) => {
  wardBounce(shader,renderer);
  shader.vertexShader='attribute float finishRoughness; varying float vFinishRoughness;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishRoughness=finishRoughness;');
  shader.fragmentShader='varying float vFinishRoughness;\n'+shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vFinishRoughness;');
};
