import { useMemo } from 'react';
import { BackSide, Color, Vector3 } from 'three';
import {useBakedSurface} from './useBakedSurface';
import cloudUrl from './day-clouds.webp';
import type { Part } from './SceneryBatch';

type V = Part['p'];

export function DaySky({ sun, warm }: { sun: V; warm: boolean }) {
  const clouds=useBakedSurface(cloudUrl,'mask');
  const uniforms = useMemo(() => ({ sun: { value: new Vector3(...sun).normalize() },
    clouds:{value:clouds},hasClouds:{value:!!clouds},zenith: { value: new Color(warm ? "#6486ac" : "#417fba") }, horizon: { value: new Color(warm ? "#f3d9b5" : "#c9e3ec") } }), [sun, warm,clouds]);
  return <mesh name="day-sky" renderOrder={-100} frustumCulled={false} raycast={() => null}>
    <sphereGeometry args={[1, 36, 18]} />
    <shaderMaterial side={BackSide} depthTest={false} depthWrite={false} uniforms={uniforms} vertexShader={`varying vec3 dir; varying vec2 cloudUv;
      void main(){dir=position; cloudUv=uv;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(clip.xy,0.,clip.w);}`}
      fragmentShader={`varying vec3 dir;varying vec2 cloudUv; uniform vec3 sun, zenith, horizon; uniform sampler2D clouds;uniform bool hasClouds;
      void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 c=mix(horizon,zenith,pow(h,.48));
        float cloud=hasClouds?texture2D(clouds,cloudUv).r:0.;c=mix(c,vec3(.92,.94,.94),.78*cloud);
        float a=clamp(dot(d,sun),0.,1.);float disk=1.-smoothstep(.007,.013,length(d-sun));
        c+=vec3(1.,.78,.48)*(.23*pow(a,30.)+.45*pow(a,330.)+1.8*disk)*(1.-.72*cloud);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`} />
  </mesh>;
}
