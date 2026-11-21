import {useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {MathUtils,Vector3} from 'three';

// The landing is a portrait stage. Only emissions are quieter here, never
// silhouettes, star resolution, exposure or the character's material. Looking
// up or sighting the pulsar opens the sky; leaving the pad also opens it.
export function useSkyAttention(){
  const s=useMemo(()=>({uniform:{value:0},eye:new Vector3(),dir:new Vector3(),sight:new Vector3()}),[]);
  useFrame(({gl,camera},dt)=>{const cam=gl.xr.isPresenting?gl.xr.getCamera():camera;
    cam.getWorldPosition(s.eye);cam.getWorldDirection(s.dir);
    const travel=Math.max(MathUtils.smoothstep(Math.hypot(s.eye.x,s.eye.z),12,21),MathUtils.smoothstep(s.eye.y,3.6,8.5),MathUtils.smoothstep(-s.eye.y,2.4,7.5));
    const pulsar=s.sight.set(67,20,-246).sub(s.eye).normalize();
    const watch=Math.max(MathUtils.smoothstep(s.dir.y,.16,.55),MathUtils.smoothstep(s.dir.dot(pulsar),.989,.9985),travel);
    s.uniform.value+=(watch-s.uniform.value)*(1-Math.exp(-Math.min(.1,dt)*3));
  });return s.uniform;
}
