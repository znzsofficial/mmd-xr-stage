import {useFrame} from '@react-three/fiber';
import {useMemo} from 'react';
import {BackSide} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import firmament from './winter-arm.webp';

// Translation-free per-eye reprojection: the moons have angular diameters,
// not metre-sized shells that the visitor can walk through on the far side.
export function PlanetSky(){
  const map=useBakedSurface(firmament),u=useMemo(()=>({sky:{value:map},clock:{value:0}}),[map]);
  useFrame((_,dt)=>{u.clock.value=(u.clock.value+Math.min(.1,dt))%48;});
  if(!map)return null;
  return <mesh name="planet:winter-arm" frustumCulled={false} renderOrder={-100} raycast={()=>null}><sphereGeometry args={[1,64,40]}/>
    <shaderMaterial uniforms={u} side={BackSide} depthWrite={false} depthTest={false} toneMapped={false}
      vertexShader={`varying vec2 skyUV;varying vec3 dir;void main(){skyUV=uv;dir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=p.xyww;}`}
      fragmentShader={`uniform sampler2D sky;uniform float clock;varying vec2 skyUV;varying vec3 dir;
        float trail(vec3 n,vec3 origin,vec3 tangent,float t){vec3 a=normalize(origin);vec3 b=normalize(tangent-dot(tangent,a)*a);float along=dot(n,b),crossed=dot(n,cross(a,b));float tail=t*.54-.22-along;
          return smoothstep(.90,.98,dot(n,a))*(1.-smoothstep(.0005,.0032,abs(crossed)))*smoothstep(-.002,.001,tail)*exp(-max(0.,tail)*55.)*smoothstep(0.,.12,t)*(1.-smoothstep(.82,1.,t));}
        void main(){vec3 n=normalize(dir);vec3 col=texture2D(sky,skyUV).rgb;
          col+=vec3(.50,.76,.98)*trail(n,vec3(.13,.28,-1.),vec3(.96,-.28,.2),mod(clock,12.)/1.4);
          col+=vec3(.92,.63,.45)*trail(n,vec3(-.61,-.66,.58),vec3(-.4,.8,.1),mod(clock+5.,16.)/1.75);
          gl_FragColor=vec4(col,1.);
          #include <colorspace_fragment>
        }`}/></mesh>;
}
