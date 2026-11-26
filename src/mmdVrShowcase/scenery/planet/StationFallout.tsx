import {RoomShader} from '../daylightMaterials';
import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,Float32BufferAttribute,InstancedBufferAttribute,InstancedBufferGeometry,Vector3} from 'three';
import {moonRadius} from './moonSurface';
import {moons,sunDirection} from './windAtlas';
import {noPick} from '../sceneryPaint';

/** Two fields of airborne grains, one batch. Both leave the ground at the
 * same range of speeds; their heights and periods follow local gravity. */
function grains(){
  const g=new InstancedBufferGeometry(),foot:number[]=[],up:number[]=[],flow:number[]=[],meta:number[]=[],rgb:number[]=[];
  // A ridged mineral splinter, rather than a camera-facing dot.
  g.setAttribute('position',new Float32BufferAttribute([0,1.4,0,-.53,0,-.4,.44,0,-.4,.58,0,.35,-.42,0,.57,0,-.72,0],3));
  g.setIndex([0,2,1,0,3,2,0,4,3,0,1,4,5,1,2,5,2,3,5,3,4,5,4,1]);
  const p=new Vector3(),n=new Vector3(),a=new Vector3(),b=new Vector3(),v=new Vector3(),c=new Color();
  for(const m of moons){if(m.id!=='salt'&&m.id!=='glaze')continue;
    const salt=m.id==='salt';a.set(0,0,1).cross(m.station.up).normalize();b.crossVectors(m.station.up,a);
    for(let i=0;i<44;i++){
      const angle=i*2.399963,spread=.59+.44*((i*.754877)%1),spin=i*.618034;
      n.copy(m.station.up).addScaledVector(a,spread*Math.cos(angle)/m.radius).addScaledVector(b,spread*Math.sin(angle)/m.radius).normalize();
      p.copy(n).multiplyScalar(moonRadius(m,n.x,n.y,n.z)+.018).add(m.centre);foot.push(...p.toArray());up.push(...n.toArray());
      v.copy(a).multiplyScalar(Math.cos(angle)).addScaledVector(b,Math.sin(angle)).multiplyScalar(.11+.14*(spin%1));flow.push(...v.toArray());
      meta.push(m.surfaceGravity,1.15+.45*((i*.41421)%1),spin%1,(salt?.029:.022)*(1+.48*Math.sin(i*53)));
      c.set((salt?['#f2eeff','#c3e6ff','#c6fff1','#f6badc']:['#ffd3a4','#ff944b','#ff7248','#ffbd75'])[i%4]);rgb.push(c.r,c.g,c.b);
    }
  }
  for(const [key,data,n] of [['launch',foot,3],['axis',up,3],['drift',flow,3],['grain',meta,4],['tint',rgb,3]] as const)g.setAttribute(key,new InstancedBufferAttribute(Float32Array.from(data),n));
  g.instanceCount=meta.length/4;return g;
}
export function StationFallout(){
  const g=useMemo(grains,[]),u=useMemo(()=>({time:{value:0},sun:{value:sunDirection}}),[]);
  useEffect(()=>()=>g.dispose(),[g]);useFrame((_,dt)=>{u.time.value+=Math.min(.05,dt);});
  return <mesh name="planet:gravity-grains" geometry={g} frustumCulled={false} raycast={noPick} userData={{playerCollision:false}}>
    <RoomShader effect="fallout" uniforms={u} toneMapped={false} vertexShader={`
      attribute vec3 launch,axis,drift,tint;attribute vec4 grain;uniform float time;uniform vec3 sun;varying vec3 ink;
      void main(){float duration=2.*grain.y/grain.x;float t=fract(time/(duration+.46)+grain.z)*(duration+.46);
        float h=max(0.,grain.y*t-.5*grain.x*t*t);vec3 foot=launch+axis*h+drift*t;
        float a=t*1.8+grain.z*6.28;vec3 U=normalize(cross(axis,drift)),V=cross(axis,U);
        vec3 side=cos(a)*U+sin(a)*V,across=cross(axis,side);
        float sz=grain.w*smoothstep(0.,.10,h)*smoothstep(.26,.82,distance(foot,cameraPosition));
        vec3 p=foot+sz*(side*position.x+axis*position.y+across*position.z);
        ink=tint*(.64+.55*max(dot(side,sun),0.)+.32*max(position.y,0.));gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
      }`} fragmentShader={`varying vec3 ink;void main(){gl_FragColor=vec4(ink,1.);
        #include <colorspace_fragment>
      }`}/>
  </mesh>;
}
