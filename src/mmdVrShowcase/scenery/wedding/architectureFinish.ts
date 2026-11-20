import type {MeshStandardMaterial} from 'three';

type Compile = MeshStandardMaterial['onBeforeCompile'];

/** Both the paving and the gate have a byte of sky visibility at each vertex.
 * This is not an albedo tint: in direct-only light the result is identical. */
export const ambientReveal:Compile = shader=>{
  shader.vertexShader = 'attribute float skyVisibility; varying float vReveal;\n'+shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vReveal = skyVisibility;');
  shader.fragmentShader = 'varying float vReveal;\n'+shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
    reflectedLight.indirectDiffuse *= vReveal;
    reflectedLight.indirectSpecular *= vReveal;`);
};

/** Same gate draw and mip derivatives as the print; select the data swatch at
 * vertices (the authored atlas islands never straddle a cell). One extra read
 * supplies both the slope and its GGX lobe. No second fetch for roughness. */
export const gateFinish:Compile = (shader,renderer)=>{
  ambientReveal(shader,renderer);
  shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
    vec2 cell = floor(uv * 4.0);
    float slot = cell.x + 4.0 * (3.0 - cell.y);
    vec2 origin = slot == 1.0 ? vec2(0., .5) : slot == 3.0 ? vec2(.5) : slot == 5.0 ? vec2(0.) : vec2(.5, 0.);
    vec2 island = ((uv * 4.0 - cell) * 512.0 - 12.5) / 487.0;
    vNormalMapUv = origin + (8.5 + 239.0 * island) / 512.0;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
    vec3 finish = texture2D(normalMap, vNormalMapUv).rgb;
    float roughnessFactor = finish.b;`).replace('#include <normal_fragment_maps>', `
    vec2 slope = (finish.rg * 255.0 - 128.0) / 127.0;
    normal = normalize(tbn * vec3(slope, sqrt(max(.001, 1.0-dot(slope,slope)))));`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
    // No environment cube in this room. Approximate just the broad opening
    // onto the light court in the door film; its energy is the room's actual
    // sky fill. Neither a white albedo stripe nor another direct light.
    if (material.roughness < .44) {
      vec3 ray = transformDirectionByInverseViewMatrix(reflect(-geometryViewDir, normal), viewMatrix);
      float facing = dot(vec3(abs(ray.x), ray.yz), vec3(.783, .183, -.595));
      float sky = smoothstep(.90 - material.roughness * .13, .991, facing);
      float grazing = 1.0 - saturate(dot(geometryViewDir, normal));
      reflectedLight.indirectSpecular += irradiance * (.004 + sky * (.035 + .067 * grazing * grazing));
    }`);
};
