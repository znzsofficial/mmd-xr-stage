import {BackSide} from 'three';
import {RoomShader} from '../daylightMaterials';
import {noPick} from '../sceneryPaint';
import {harbourSkySampling,useHarbourSkyUniforms} from './harbourAtmosphere';

const vertex=`varying vec3 harbourRay;
void main(){
  harbourRay=position;
  vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
  gl_Position=vec4(p.xy,0.,p.w);
}`;
const fragment=`varying vec3 harbourRay;
${harbourSkySampling}
void main(){
  vec3 ray=normalize(harbourRay);
  vec3 sky=sampleHarbourSky(ray);
  float a=length(ray-harbourSunDirection());
  float disc=1.-smoothstep(.0055,.0074,a);
  gl_FragColor=vec4(mix(sky,vec3(.68)+harbourSunColor*.52,disc),1.);
  #include <colorspace_fragment>
}`;

export function HarbourSky(){
  const uniforms=useHarbourSkyUniforms('sky');
  return <mesh name="terminus:clear-sky" frustumCulled={false} renderOrder={-100} raycast={noPick}>
    <sphereGeometry args={[1,48,24]}/>
    <RoomShader effect="harbourSky" side={BackSide} uniforms={uniforms} depthTest={false} depthWrite={false}
      onUpdate={material=>{if(material.isShaderMaterial)material.uniforms=uniforms;}}
      toneMapped={false} vertexShader={vertex} fragmentShader={fragment}/>
  </mesh>;
}
