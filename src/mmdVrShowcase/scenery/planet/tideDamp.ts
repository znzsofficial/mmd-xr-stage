import type {MeshStandardMaterial} from 'three';
import {tideWaterBounds as bay} from './tideLayout';

/** Saturation changes where this tide can actually reach. The high-tide
 * stain on an exposed tread is matte; the newly wetted part catches light.
 * One scalar interpolator and the existing material's light evaluation. */
export function foreshoreFinish(clock:{readonly level:number}):MeshStandardMaterial['onBeforeCompile']{
  return shader=>{
    shader.uniforms.tideStand={get value(){return clock.level;}};
    shader.vertexShader=`uniform float tideStand; varying float vTideSoak;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec2 inlet=smoothstep(vec2(${bay.minX},${bay.minZ}),vec2(${bay.minX+.15},${bay.minZ+.18}),position.xz)
             *(1.-smoothstep(vec2(${bay.maxX-.20},${bay.maxZ-.18}),vec2(${bay.maxX},${bay.maxZ}),position.xz));
        vTideSoak=inlet.x*inlet.y*(1.-smoothstep(tideStand+.025,tideStand+.16,position.y));`);
    shader.fragmentShader=`varying float vTideSoak;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.rgb*=mix(vec3(1.),vec3(.58,.71,.83),vTideSoak);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.36,vTideSoak);`);
  };
}
