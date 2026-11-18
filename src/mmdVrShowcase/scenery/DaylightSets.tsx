import { useMemo } from 'react';
import { BackSide, Color, Vector3 } from 'three';
import type { Part } from './SceneryBatch';
import type { SceneryId } from './catalog';
import { Classroom } from './Classroom';
import { CLASS_SUN } from './ClassroomLayout';
import { POOL_SUN, PoolTerrace } from './PoolTerrace';
import { Meadow } from './Meadow';
import { MEADOW_SUN } from './placementAreas';

type DaySet = Extract<SceneryId, 'classroom' | 'pool' | 'lawn'>;
type V = Part['p'];
export const SUN_POSITIONS: Record<DaySet,V> = {classroom:CLASS_SUN,pool:POOL_SUN,lawn:MEADOW_SUN};

export function DaySky({ sun, warm }: { sun: V; warm: boolean }) {
  const uniforms = useMemo(() => ({ sun: { value: new Vector3(...sun).normalize() },
    zenith: { value: new Color(warm ? "#6486ac" : "#417fba") }, horizon: { value: new Color(warm ? "#f3d9b5" : "#c9e3ec") } }), [sun, warm]);
  return <mesh name="day-sky" renderOrder={-100} frustumCulled={false} raycast={() => null}>
    <sphereGeometry args={[1, 36, 18]} />
    <shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms} vertexShader={`varying vec3 dir;
      void main(){dir=position; vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=clip.xyww;}`}
      fragmentShader={`varying vec3 dir; uniform vec3 sun, zenith, horizon;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,78.31)))*13758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 c=mix(horizon,zenith,pow(h,.48));
        vec2 plane=d.xz/max(.12,h+.04);vec2 p=plane*vec2(2.4,4.1);float n=noise(p)*.6+noise(2.03*p)*.28+noise(4.23*p)*.12;
        float cloud=smoothstep(.56,.75,n)*smoothstep(.015,.22,h);c=mix(c,vec3(.92,.94,.94),.78*cloud);
        float a=clamp(dot(d,sun),0.,1.);float disk=1.-smoothstep(.007,.013,length(d-sun));
        c+=vec3(1.,.78,.48)*(.23*pow(a,30.)+.45*pow(a,330.)+1.8*disk)*(1.-.72*cloud);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`} />
  </mesh>;
}

export function DaylightSet({ id, shadows }: { id: DaySet; shadows: boolean }) {
  switch(id){
    case 'classroom': return <Classroom shadows={shadows} />;
    case 'pool': return <PoolTerrace shadows={shadows} />;
    case 'lawn': return <Meadow shadows={shadows} />;
  }
}
