import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import type { SceneryId } from '../scenery/catalog';
import { isStoryRoom, type StoryRoom } from '../play/stagePlay';
import { COURT_SHOTS } from '../scenery/ObservatoryLayout';
import { CHAPEL_SHOTS } from '../scenery/ChapelLayout';
import {campusRoom,otherZone} from '../scenery/CampusLayout';
import {walkBetweenZones,hintLawnPrints} from '../scenery/campusTransit';
const campusShots={classroom:[{key:'campusWindow',eye:[.6,1.58,-.35],aim:[-17.9,1.26,.4]},{key:'campusHall',eye:[-3.31,1.61,7.31],aim:[-12.5,1.23,7.12]},{key:'campusGoLawn',eye:[2.73,1.61,.42],aim:[-4.2,1.42,-6.4]}],
  lawn:[{key:'campusSchool',eye:[-.9,1.62,2.4],aim:[10.8,1.53,-3.6]},{key:'campusArbor',eye:[-.73,1.58,.6],aim:[-4.2,1.40,-6.4]},{key:'campusGoClass',eye:[-8.04,1.61,7.25],aim:[-3.35,1.34,6.21]}]} as const;
export const tourShots=(room:SceneryId)=>room==='chapel'?CHAPEL_SHOTS:room==='astralCourt'?COURT_SHOTS:campusRoom(room)?campusShots[room]:[];

type Point = [number,number,number];
const views: Record<SceneryId,[Point,Point]> = {
  chapel:[[.25,1.63,4.7],[0,1.68,-3.8]],
  floor:[[1.4,1.65,4.0],[0,.95,-.4]], liveHouse:[[.8,1.7,4.4],[0,1.05,-1.3]],
  classroom:[[.15,1.58,3.95],[0,1.05,-1.4]], pool:[[2.1,1.7,2.8],[0,.85,-3.7]],
  lawn:[[.6,1.65,3.7],[0,1.0,-1.4]], astralCourt:[[.85,1.65,4.4],[0,1.47,-1.25]],
};
const storyViews:Record<StoryRoom,[Point,Point]>={
  lawn:[[3,1.75,5],[3,2.05,-5]], pool:[[1.15,1.72,-2],[0,.32,-9.3]], liveHouse:[[.2,1.7,4.8],[0,1.90,-5.1]]
};
export type CameraActions = { reset():void; frame():void; center():void; story():void; tour(index:number):void };

export function ScreenCamera({actions,onReady}:{actions:RefObject<CameraActions|null>;onReady:(ready:boolean)=>void}) {
  const {camera,gl}=useThree(); const scenery=useMmdVrStore(s=>s.prefs.scenery);
  const arrival=useRef<{room:SceneryId;eye:readonly number[];aim:readonly number[]}|null>(null);
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera))return;
    const orbit=new OrbitControls(camera,gl.domElement);
    orbit.minDistance=.18;orbit.maxDistance=scenery==='astralCourt'?52:22;orbit.maxPolarAngle=Math.PI*.49;orbit.rotateSpeed=.70;
    const setLens=(fov:number)=>{camera.fov=fov;camera.updateProjectionMatrix();};
    const reset=()=>{const [eye,look]=views[scenery];setLens(50);camera.position.set(...eye);orbit.target.set(...look);orbit.update();};
    const frame=()=>{
      const b=useBackpack.getState(), live=b.selected&&b.live[b.selected];if(!live)return;
      setLens(50);const bounds=live.bounds, [x,y,z]=live.position;
      const target=new Vector3(...(bounds?.center??[x,y+.8,z]));
      const [w,h,d]=bounds?.size??[.65,1.6,.5];
      const dist=Math.min(20,Math.max(.4, .68*Math.max(h,Math.max(w,d)/Math.max(.15,camera.aspect))/Math.tan(camera.fov*Math.PI/360)+Math.max(w,d)*.5));
      const dir=camera.position.clone().sub(orbit.target).normalize();orbit.target.copy(target);camera.position.copy(target).addScaledVector(dir,dist);orbit.update();
    };
    let releaseHints:(()=>void)|undefined;
    actions.current={reset,frame,tour(index){const shot=tourShots(scenery)[index];if(!shot)return;
      if(campusRoom(scenery)&&index===2){arrival.current={room:otherZone(scenery),eye:shot.eye,aim:shot.aim};if(!walkBetweenZones(scenery))arrival.current=null;return;}
      if(scenery==='classroom'&&index===1&&!releaseHints)releaseHints=hintLawnPrints();
      setLens(scenery==='astralCourt'&&index===0?Math.min(130,Math.max(99,2*Math.atan(1.1/camera.aspect)*180/Math.PI)):50);camera.position.fromArray(shot.eye);orbit.target.fromArray(shot.aim);orbit.update();},story(){if(isStoryRoom(scenery)){const [eye,look]=storyViews[scenery];camera.position.set(...eye);orbit.target.set(...look);orbit.update();}},center(){const b=useBackpack.getState(),s=useMmdVrStore.getState();if(!b.draft||s.physicsBusy||s.assetLoad.running||s.physicsFatal)return;
      const prev=b.live[b.draft], transform=prev&&(s.models.find(m=>m.id===prev.runtimeId)??s.objects.find(o=>o.id===prev.runtimeId));
      b.confirmPlace(b.draft,0,0,transform?.rotationY??Math.atan2(camera.position.x,camera.position.z)*180/Math.PI);
    }};
    reset();const a=arrival.current;arrival.current=null;if(a?.room===scenery){camera.position.fromArray(a.eye);orbit.target.fromArray(a.aim);orbit.update();}orbit.enabled=!useBackpack.getState().draft;
    onReady(true);const off=useBackpack.subscribe((b,old)=>{if(old.draft!==b.draft)orbit.enabled=!b.draft;});
    return ()=>{off();releaseHints?.();actions.current=null;onReady(false);orbit.dispose();};
  },[camera,gl,scenery,actions,onReady]);
  return null;
}
