import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import type { SceneryId } from '../scenery/catalog';
import { isStoryRoom, type StoryRoom } from '../play/stagePlay';
import {roomViews,tourShots} from '../scenery/roomViews';
import {walkBetweenZones,hintLawnPrints} from '../scenery/campusTransit';
import { bindScreenCameraKeyboard } from './screenCameraKeyboard';

type Point = [number,number,number];
const storyViews:Record<StoryRoom,[Point,Point]>={
  lawn:[[3,1.75,5],[3,2.05,-5]], pool:[[1.15,1.72,-2],[0,.32,-9.3]], liveHouse:[[.2,1.7,4.8],[0,1.90,-5.1]]
};
export type CameraActions = { reset():void; frame():void; center():void; story():void; tour(index:number):void };

export function ScreenCamera({actions,onReady,viewport}:{actions:RefObject<CameraActions|null>;onReady:(ready:boolean)=>void;viewport:RefObject<HTMLDivElement|null>}) {
  const {camera,gl}=useThree(); const scenery=useMmdVrStore(s=>s.prefs.scenery);
  const arrival=useRef<{room:SceneryId;eye:readonly number[];aim:readonly number[]}|null>(null);
  const keyboard=useRef<ReturnType<typeof bindScreenCameraKeyboard>|null>(null);
  useFrame((_,delta)=>keyboard.current?.step(delta));
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera)||!viewport.current)return;
    const makeOrbit=()=>{const o=new OrbitControls(camera,gl.domElement);o.minDistance=.18;o.maxDistance=scenery==='astralCourt'?52:scenery==='glassPlanet'?38:22;o.maxPolarAngle=Math.PI*(scenery==='qinhuai'?.64:scenery==='glassPlanet'?.99:.49);o.rotateSpeed=.70;o.enabled=!useBackpack.getState().draft;return o;};
    let orbit=makeOrbit();const wup=[0,1,0] as const;
    function align(up:readonly [number,number,number]=wup){
      if(camera.up.distanceToSquared(new Vector3(...up))<1e-10)return;
      // OrbitControls captures up at construction. Switch frames before a
      // southern tour, rather than letting the next drag undo its horizon.
      keyboard.current?.dispose();orbit.dispose();camera.up.fromArray(up);orbit=makeOrbit();
      keyboard.current=bindScreenCameraKeyboard(viewport.current!,orbit,reset);
    }
    const setLens=(fov:number)=>{camera.fov=fov;camera.updateProjectionMatrix();};
    const reset=()=>{align();const [eye,look]=roomViews[scenery].entry;setLens(50);camera.position.set(...eye);orbit.target.set(...look);orbit.update();};
    const frame=()=>{
      const b=useBackpack.getState(), live=b.selected&&b.live[b.selected];if(!live)return;
      if(scenery==='glassPlanet'&&camera.up.y<.99)reset(); // actors stand on the north landing
      setLens(50);const bounds=live.bounds, [x,y,z]=live.position;
      const target=new Vector3(...(bounds?.center??[x,y+.8,z]));
      const [w,h,d]=bounds?.size??[.65,1.6,.5];
      const dist=Math.min(20,Math.max(.4, .68*Math.max(h,Math.max(w,d)/Math.max(.15,camera.aspect))/Math.tan(camera.fov*Math.PI/360)+Math.max(w,d)*.5));
      const dir=camera.position.clone().sub(orbit.target).normalize();orbit.target.copy(target);camera.position.copy(target).addScaledVector(dir,dist);orbit.update();
    };
    let releaseHints:(()=>void)|undefined;
    actions.current={reset,frame,tour(index){const shot=tourShots(scenery)[index];if(!shot)return;
      if(shot.link){arrival.current={room:shot.link.to,eye:shot.eye,aim:shot.aim};if(!walkBetweenZones(shot.link))arrival.current=null;return;}
      if(shot.preloadLawn&&!releaseHints)releaseHints=hintLawnPrints();
      align(shot.up);
      setLens(shot.overview?Math.min(130,Math.max(99,2*Math.atan(1.1/camera.aspect)*180/Math.PI)):50);camera.position.fromArray(shot.eye);orbit.target.fromArray(shot.aim);orbit.update();},story(){if(isStoryRoom(scenery)){const [eye,look]=storyViews[scenery];camera.position.set(...eye);orbit.target.set(...look);orbit.update();}},center(){const b=useBackpack.getState(),s=useMmdVrStore.getState();if(!b.draft||s.physicsBusy||s.assetLoad.running||s.physicsFatal)return;
      const prev=b.live[b.draft], transform=prev&&(s.models.find(m=>m.id===prev.runtimeId)??s.objects.find(o=>o.id===prev.runtimeId));
      b.confirmPlace(b.draft,0,0,transform?.rotationY??Math.atan2(camera.position.x,camera.position.z)*180/Math.PI);
    }};
    reset();const a=arrival.current;arrival.current=null;if(a?.room===scenery){camera.position.fromArray(a.eye);orbit.target.fromArray(a.aim);orbit.update();}orbit.enabled=!useBackpack.getState().draft;
    keyboard.current=bindScreenCameraKeyboard(viewport.current,orbit,reset);
    onReady(true);const off=useBackpack.subscribe((b,old)=>{if(old.draft!==b.draft){keyboard.current?.clear();orbit.enabled=!b.draft;}});
    return ()=>{keyboard.current?.dispose();keyboard.current=null;off();releaseHints?.();actions.current=null;onReady(false);orbit.dispose();camera.up.set(0,1,0);};
  },[camera,gl,scenery,actions,onReady,viewport]);
  return null;
}
