import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Vector3} from 'three';
import {noPick} from '../sceneryPaint';
import {reedLake,reedRadius,reedRelief,reedSeaLevel} from './reedBiosphere';

// Jewel damselflies patrol just above the lilies. Body and four veined wings
// occupy the same opaque batch; a moving silhouette survives stereo better
// than a tiny pulsing billboard. Positions are local to the moon's centre.
function skimmers(){const pos:number[]=[],colors:number[]=[],perch:number[]=[],motion:number[]=[],c=new Color();
  const u=new Vector3(),a=new Vector3(1,0,0).projectOnPlane(reedLake).normalize(),b=new Vector3().crossVectors(a,reedLake);
  for(let i=0;i<9;i++){
    const k=i*2.4,r=.07+.16*Math.sqrt(i/9);u.copy(reedLake).addScaledVector(a,r*Math.cos(k)).addScaledVector(b,r*Math.sin(k)).normalize();
    if(reedRelief(u.x,u.y,u.z)>reedSeaLevel-.07)continue;
    const n=u.clone().multiplyScalar(reedRadius+reedSeaLevel+.23+.19*(i%3));
    const vertex=(x:number,y:number,z:number,wing:number,ink:string)=>{pos.push(x,y,z);c.set(ink);colors.push(c.r,c.g,c.b);perch.push(n.x,n.y,n.z);motion.push(k,wing);};
    for(const side of [-1,1]){
      for(const [z,angle] of [[.045,.045],[.004,-.058]]){const ink=i%3?'#9ceada':'#f1c77d';
        for(const [x,y,d] of [[.008,.002,z],[.13,.010,z+angle],[.182,.005,z+angle-.007], [.008,.002,z],[.182,.005,z+angle-.007],[.080,.006,z-.016]])vertex(side*x,y,d,side,ink);
        for(const [x,y,d] of [[.132,.012,z+angle],[.169,.009,z+angle-.004],[.134,.010,z+angle-.005]])vertex(side*x,y,d,side,'#356971');}
      for(const [x,y,z] of [[0,.018,.064],[.018,0,.035],[0,.009,-.13],[.018,0,.035],[0,-.01,.065],[0,.009,-.13]])vertex(side*x,y,z,0,'#247d7b');
      for(const [x,y,z] of [[0,.015,.070],[.024,0,.059],[0,.006,.083]])vertex(side*x,y,z,0,'#cbaf60');
    }
  }
  const g=new BufferGeometry();for(const [key,list,size]of [['position',pos,3],['colour',colors,3],['perch',perch,3],['motion',motion,2]] as const)g.setAttribute(key,new Float32BufferAttribute(list,size));return g;
}
export function ReedSkimmers(){const g=useMemo(skimmers,[]),u=useMemo(()=>({cycle:{value:0}}),[]);
  useEffect(()=>()=>g.dispose(),[g]);useFrame((_,dt)=>{u.cycle.value=(u.cycle.value+Math.min(.08,dt)*.24)%(2*Math.PI);});
  return <mesh name="reed:damselflies" geometry={g} frustumCulled={false} raycast={noPick}><shaderMaterial side={DoubleSide} toneMapped={false} uniforms={u}
    vertexShader={`attribute vec3 colour,perch;attribute vec2 motion;uniform float cycle;varying vec3 ink;
      void main(){vec3 N=normalize(perch),E=normalize(cross(vec3(0.,0.,1.),N)),B=cross(N,E);
        float a=cycle+motion.x;vec3 p=perch+E*.45*sin(a*2.)+B*.30*sin(a*3.)+N*.074*cos(a*2.);
        vec3 forward=normalize(E*(.94*cos(a*2.))+B*(.91*cos(a*3.))+.018*E),across=cross(N,forward);
        float flap=.36+.34*sin(a*54.);float w=step(.5,abs(motion.y));
        float size=.73*smoothstep(.28,.82,length((modelViewMatrix*vec4(p,1.)).xyz));
        p+=size*(across*position.x*(1.-w*.13*flap)+N*(position.y+abs(position.x)*w*flap)+forward*position.z);
        ink=colour*(.80+.17*clamp(abs(position.x)*5.,0.,1.));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`} fragmentShader={`varying vec3 ink;void main(){gl_FragColor=vec4(ink,1.);
        #include <colorspace_fragment>
      }`}/></mesh>;
}
