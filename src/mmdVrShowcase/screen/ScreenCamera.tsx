import { useLayoutEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import type { SceneryId } from '../scenery/catalog';

type Point = [number,number,number];
const views: Record<SceneryId,[Point,Point]> = {
  floor:[[1.4,1.65,4.0],[0,.95,-.4]], liveHouse:[[.8,1.7,4.4],[0,1.05,-1.3]],
  classroom:[[.15,1.58,3.95],[0,1.05,-1.4]], pool:[[2.1,1.7,2.8],[0,.85,-3.7]],
  lawn:[[.6,1.65,3.7],[0,1.0,-1.4]], astralCourt:[[.85,1.65,4.4],[0,1.47,-1.25]],
};
export type CameraActions = { reset():void; frame():void; center():void };

export function ScreenCamera({actions}:{actions:RefObject<CameraActions|null>}) {
  const {camera,gl}=useThree(); const scenery=useMmdVrStore(s=>s.prefs.scenery);
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera))return;
    const orbit=new OrbitControls(camera,gl.domElement);
    orbit.minDistance=.18;orbit.maxDistance=22;orbit.maxPolarAngle=Math.PI*.49;orbit.rotateSpeed=.70;
    const reset=()=>{const [eye,look]=views[scenery];camera.position.set(...eye);orbit.target.set(...look);orbit.update();};
    const frame=()=>{
      const b=useBackpack.getState(), live=b.selected&&b.live[b.selected];if(!live)return;
      const bounds=live.bounds, [x,y,z]=live.position;
      const target=new Vector3(...(bounds?.center??[x,y+.8,z]));
      const [w,h,d]=bounds?.size??[.65,1.6,.5];
      const dist=Math.min(20,Math.max(.4, .68*Math.max(h,Math.max(w,d)/Math.max(.15,camera.aspect))/Math.tan(camera.fov*Math.PI/360)+Math.max(w,d)*.5));
      const dir=camera.position.clone().sub(orbit.target).normalize();orbit.target.copy(target);camera.position.copy(target).addScaledVector(dir,dist);orbit.update();
    };
    actions.current={reset,frame,center(){const b=useBackpack.getState(),s=useMmdVrStore.getState();if(!b.draft||s.physicsBusy||s.assetLoad.running||s.physicsFatal)return;
      const prev=b.live[b.draft], transform=prev&&(s.models.find(m=>m.id===prev.runtimeId)??s.objects.find(o=>o.id===prev.runtimeId));
      b.confirmPlace(b.draft,0,0,transform?.rotationY??Math.atan2(camera.position.x,camera.position.z)*180/Math.PI);
    }};
    reset();orbit.enabled=!useBackpack.getState().draft;
    const off=useBackpack.subscribe((b,old)=>{if(old.draft!==b.draft)orbit.enabled=!b.draft;});
    return ()=>{off();actions.current=null;orbit.dispose();};
  },[camera,gl,scenery,actions]);
  return null;
}
