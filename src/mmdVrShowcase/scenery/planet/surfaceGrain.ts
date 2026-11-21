import {useLayoutEffect} from 'react';
import {RepeatWrapping,type MeshStandardMaterial,type Texture} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import url from './mineral-grain.webp';

export function useSurfaceGrain(){
  const map=useBakedSurface(url,'data');
  useLayoutEffect(()=>{if(map){map.wrapS=map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map]);
  return map;
}

// One repeated plate sampled on three tangent projections. Explicit gradients
// preserve mips even at oblique angles; weights follow the geometric normal.
export const surfaceGrain=`
  uniform sampler2D grainMap; uniform float grainReady;
  vec3 grainAt(vec3 p,vec3 N,float freq,float eyeDist){
    vec3 q=p*freq;vec3 dx=dFdx(q),dy=dFdy(q);vec3 w=abs(N);w=w*w;w=w*w;w/=max(.0001,w.x+w.y+w.z);
    float amount=grainReady*(1.-smoothstep(5.,12.,eyeDist));
    if(amount<=0.)return vec3(0.);
    vec3 grain=textureGrad(grainMap,q.yz+.17,dx.yz,dy.yz).rgb*w.x
      +textureGrad(grainMap,q.zx+.43,dx.zx,dy.zx).rgb*w.y
      +textureGrad(grainMap,q.xy+.71,dx.xy,dy.xy).rgb*w.z;
    return amount*(grain-vec3(.45,.54,.10));
  }`;

/** The north deck still receives the normal Three lighting/shadows. Add the
 * enamel grain to its paint (and to the mineral crust) before lighting. */
export function opalGrain(map:Texture|null,strength:number):MeshStandardMaterial['onBeforeCompile']{
  return shader=>{
    shader.uniforms.grainMap={value:map};shader.uniforms.grainReady={value:map?1:0};shader.uniforms.grainGain={value:strength};
    shader.vertexShader='varying vec3 rockPoint,rockNormal,rockEye;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      rockPoint=position;rockNormal=normal;rockEye=cameraPosition-(modelMatrix*vec4(position,1.)).xyz;`);
    shader.fragmentShader='varying vec3 rockPoint,rockNormal,rockEye;uniform float grainGain;\n'+surfaceGrain+'\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 grit=grainAt(rockPoint,normalize(rockNormal),1.65,length(rockEye));
      diffuseColor.rgb*=max(.40,1.+grainGain*(grit.r*1.1+grit.g*.65-grit.b*.29));`);
  };
}
