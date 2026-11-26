import {RoomShader} from '../../daylightMaterials';
import {useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {BackSide,type Texture} from 'three';
import {noPick} from '../../sceneryPaint';
import {sunDirection} from '../windAtlas';
import {sampleLongitude,skySpace} from './skySpace';
import {useSkyAttention} from './skyAttention';

export function TidalNebula({map}:{map:Texture|null}){
  const attention=useSkyAttention(),u=useMemo(()=>({fields:{value:map},mapped:{value:map?1:0},clock:{value:0},sunDir:{value:sunDirection},attention}),[map,attention]);
  useFrame((_,dt)=>{u.clock.value=(u.clock.value+Math.min(.1,dt))%48;u.attention.value=attention.value;});
  return <mesh name="sky:tidal-nebula" frustumCulled={false} renderOrder={-1000} raycast={noPick}><sphereGeometry args={[1,48,32]}/>
    <RoomShader effect="nebula" uniforms={u} side={BackSide} depthWrite={false} depthTest={false} toneMapped={false}
      vertexShader={`varying vec3 dir;void main(){dir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=p.xyww;}`}
      fragmentShader={`${skySpace}${sampleLongitude}
        uniform sampler2D fields;uniform float mapped,clock,attention;uniform vec3 sunDir;varying vec3 dir;
        float trail(vec3 n,vec3 origin,vec3 tangent,float t){vec3 a=normalize(origin);vec3 b=normalize(tangent-dot(tangent,a)*a);float along=dot(n,b),off=dot(n,cross(a,b)),tail=t*.54-.22-along;
          return smoothstep(.90,.98,dot(n,a))*(1.-smoothstep(.0005,.0032,abs(off)))*smoothstep(-.002,.001,tail)*exp(-max(0.,tail)*55.)*smoothstep(0.,.12,t)*(1.-smoothstep(.82,1.,t));}
        void main(){vec3 n=normalize(dir),eye=skyEye(cameraPosition);vec3 farN=shellDir(eye,n,emissionDistance);
          vec3 gas=sampleLongitude(fields,shellUV(farN)).rgb*mapped;
          float dust=sampleLongitude(fields,shellUV(shellDir(eye,n,dustDistance))).b*mapped;
          float warm=smoothstep(-.44,.61,farN.x-.13*farN.z+.16*sin(farN.z*4.));
          vec3 cloud=mix(vec3(.019,.17,.32),vec3(.31,.066,.12),warm);
          vec3 filament=mix(vec3(.085,.58,.76),vec3(.79,.24,.11),warm);
          vec3 col=vec3(.0015,.0026,.008)+(.78*gas.r*gas.r*cloud+.72*gas.g*gas.g*filament)*(1.-.93*dust)*mix(.30,1.,attention);
          float radius=length(n-sunDir),aa=max(.0006,fwidth(radius));
          col+=vec3(1.,.86,.64)*((1.-smoothstep(.012-aa,.012+aa,radius))*2.1+.25*exp(-radius*82.)+.028*exp(-radius*12.));
          col+=vec3(.50,.76,.98)*trail(n,vec3(.13,.28,-1.),vec3(.96,-.28,.2),mod(clock,12.)/1.4);
          col+=vec3(.92,.63,.45)*trail(n,vec3(-.61,-.66,.58),vec3(-.4,.8,.1),mod(clock+5.,16.)/1.75);
          gl_FragColor=vec4(col,1.);
          #include <colorspace_fragment>
        }`}/></mesh>;
}
