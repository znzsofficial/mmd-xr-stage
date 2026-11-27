import {useMemo, type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {MathUtils, Vector3, type DirectionalLight} from 'three';
import {SHORE_SUN} from './shoreLayout';

// Move only the orthographic crop. The water, actors, buildings and foliage
// must keep the same light direction and the station's original texel density.
const axis=new Vector3(...SHORE_SUN).normalize();
const right=new Vector3().crossVectors(new Vector3(0,1,0),axis).normalize();
const up=new Vector3().crossVectors(axis,right);
export function HarbourShadows({sun}:{sun:RefObject<DirectionalLight|null>}){
  const scratch=useMemo(()=>({eye:new Vector3(),direction:new Vector3(),focus:new Vector3()}),[]);
  useFrame(({camera,gl})=>{
    const light=sun.current;if(!light?.castShadow)return;
    const eyes=gl.xr.isPresenting?gl.xr.getCamera().cameras:[];
    if(eyes.length){
      // Three already composed the tracked eye matrices with the walking
      // origin. Updating an unparented sub-camera here would lose that origin.
      scratch.eye.setFromMatrixPosition(eyes[0].matrixWorld);
      if(eyes[1])scratch.eye.lerp(scratch.focus.setFromMatrixPosition(eyes[1].matrixWorld),.5);
      scratch.direction.set(0,0,-1).transformDirection(eyes[0].matrixWorld);
    }else{camera.getWorldPosition(scratch.eye);camera.getWorldDirection(scratch.direction);}
    const focus=scratch.focus.copy(scratch.eye).addScaledVector(scratch.direction,6);
    // Keep the old map exactly on the quay. A shot facing back at the station
    // from the park follows the ground in front of the viewer, not their back.
    const inland=MathUtils.smoothstep(focus.z,4,17);
    focus.set(MathUtils.clamp(focus.x,-4,24),1.8,MathUtils.clamp(focus.z,0,38)).multiplyScalar(inland);
    const shadow=light.shadow,cam=shadow.camera,extent=13,texel=2*extent/shadow.mapSize.x;
    const x=Math.round(focus.dot(right)/texel)*texel,y=Math.round(focus.dot(up)/texel)*texel;
    if(cam.left===x-extent&&cam.bottom===y-extent)return;
    cam.left=x-extent;cam.right=x+extent;cam.bottom=y-extent;cam.top=y+extent;
    cam.updateProjectionMatrix();shadow.needsUpdate=true;
  });
  return null;
}
