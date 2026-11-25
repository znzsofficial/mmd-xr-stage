import { attachMmdSdefSkinning } from '@yohawing/three-mmd-loader';
import type { Material } from 'three';

const installed=new WeakSet<Material>();

/** The loader's special skin blends *rotations*. Three's attached bone
 * palette also contains the actor's placement, including its uniform scale.
 * Strip that common frame before the quaternion blend; modelView applies it
 * once on the way out. Ordinary linear vertices retain Three's normal path. */
export function useRigSpaceSkinning(material:Material){
  if(installed.has(material))return;
  installed.add(material);
  attachMmdSdefSkinning(material); // colour, outline and authored depth draws
  const compile=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    shader.vertexShader=shader.vertexShader.replace('#include <skinning_pars_vertex>',`#include <skinning_pars_vertex>
      #ifdef USE_SKINNING
        mat4 stageRigBone(const in float i) { return (bindMatrix * bindMatrixInverse) * getBoneMatrix(i); }
      #endif`);
    // The pinned loader expands the first occurrence of each include. Keep
    // the second one untouched for BDEF and let Three expand it as usual.
    for(const chunk of ['skinnormal_vertex','skinning_vertex']){
      const include=`#include <${chunk}>`;
      shader.vertexShader=shader.vertexShader.replace(include,`#ifdef USE_SKINNING
        if (matricesSdefEnabled >= 0.5 || matricesQdefEnabled >= 0.5) {
          #define getBoneMatrix stageRigBone
          #define bindMatrixInverse inverse(bindMatrix)
          ${include}
          #undef bindMatrixInverse
          #undef getBoneMatrix
        } else {
          ${include}
        }
      #endif`);
    }
    compile(shader,renderer);
  };
  material.customProgramCacheKey=()=>`${key()}-stage-rig-space-1`;
  material.needsUpdate=true;
}
