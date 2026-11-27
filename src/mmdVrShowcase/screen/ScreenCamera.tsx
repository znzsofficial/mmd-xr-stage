import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { useLanguageStore } from '../../languageStore';
import type { SceneryId } from '../scenery/catalog';
import { isStoryRoom, type StoryRoom } from '../play/stagePlay';
import {roomViews,tourShots} from '../scenery/roomViews';
import {walkBetweenZones,hintLawnPrints} from '../scenery/campusTransit';
import { bindScreenCameraKeyboard } from './screenCameraKeyboard';
import {screenStreetTravel} from './streetTravel';
import {RoomGate} from '../scenery/connections';
import {usePoseSession} from '../pose/poseSession';
import {screenWindTravel} from './screenWindTravel';
import {usePelvic} from '../pelvic/store';
import {upperBodyView,type CloseUpFocus,type ScreenCloseUp} from './upperBodyView';
import {planetCenterDrop} from './planetCenterDrop';

type Point = [number,number,number];
const storyViews:Record<StoryRoom,[Point,Point]>={
  lawn:[[3,1.75,5],[3,2.05,-5]], pool:[[1.15,1.72,-2],[0,.32,-9.3]], liveHouse:[[.2,1.7,4.8],[0,1.90,-5.1]]
};
export type CameraActions = { reset():void; frame():void; upperBody:ScreenCloseUp['toggle']; inspectStand():void; center():void; story():void; tour(index:number):void };

export function ScreenCamera({actions,onReady,onCloseUpChange,viewport}:{actions:RefObject<CameraActions|null>;onReady:(ready:boolean)=>void;onCloseUpChange:(focus:CloseUpFocus|null)=>void;viewport:RefObject<HTMLDivElement|null>}) {
  const {camera,gl,scene}=useThree(); const scenery=useMmdVrStore(s=>s.prefs.scenery);
  const epoch=useMmdVrStore(s=>s.entryEpoch);
  const arrival=useRef<{room:SceneryId;eye:readonly number[];aim:readonly number[];walking?:boolean}|null>(null);
  const heldKeys=useRef(new Set<string>());
  const keyboard=useRef<ReturnType<typeof bindScreenCameraKeyboard>|null>(null);
  useFrame((_,delta)=>keyboard.current?.step(delta));
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera)||!viewport.current)return;
    const steering=new Vector3(),orbitUp=new Vector3(0,1,0);
    const wind=scenery==='glassPlanet'?screenWindTravel((direction,weight,range)=>{
      steering.subVectors(orbit.target,camera.position);const distance=steering.length();
      steering.normalize().lerp(direction,weight).normalize();orbit.target.copy(camera.position).addScaledVector(steering,distance+(range-distance)*weight);
      camera.up.set(0,1,0);
    },(arc,up)=>{orbit.target.sub(camera.position).applyQuaternion(arc).add(camera.position);camera.up.copy(up);}):undefined, travel=wind??screenStreetTravel(scene,scenery);
    const gate=new RoomGate();
    const steps={held:heldKeys.current,beforeWalk(eye:Vector3,aim:Vector3,d:Vector3){
      if(!gate.hasExits(scenery))return true;
      // Screens can fly to inspect a roof or use an overhead tour. A crossing
      // is a horizontal step at the actual doorway, not flight over its XZ.
      const link=gate.crossing(scenery,eye.x,eye.z,eye.x+d.x,eye.z+d.z,eye.y-1.65);
      if(!link)return true;
      const [tx,tz]=link.offset;
      arrival.current={room:link.to,walking:true,eye:[eye.x+d.x+tx,eye.y+d.y,eye.z+d.z+tz],aim:[aim.x+d.x+tx,aim.y+d.y,aim.z+d.z+tz]};
      if(walkBetweenZones(link))return true;
      arrival.current=null;return false;
    }};
    const canOrbit=()=>!useBackpack.getState().draft&&!usePoseSession.getState().dragging;
    const makeOrbit=()=>{orbitUp.copy(camera.up);const o=new OrbitControls(camera,gl.domElement);o.minDistance=.18;o.maxDistance=scenery==='astralCourt'?52:scenery==='glassPlanet'?38:22;o.maxPolarAngle=Math.PI*(scenery==='qinhuai'?.64:scenery==='glassPlanet'?1:scenery==='arcadeHall'?.99:scenery==='seasideTerminus'?.83:.49);o.rotateSpeed=.70;o.enabled=canOrbit();return o;};
    let orbit=makeOrbit();const wup=[0,1,0] as const;
    function align(up:readonly [number,number,number]=wup,preserveHeld=false){
      camera.up.fromArray(up);if(orbitUp.distanceToSquared(camera.up)<1e-10)return;
      const target=orbit.target.clone();
      keyboard.current?.dispose(preserveHeld);orbit.dispose();orbit=makeOrbit();orbit.target.copy(target);orbit.update();
      keyboard.current=bindScreenCameraKeyboard(viewport.current!,orbit,reset,travel,steps);
    }
    // OrbitControls captures its drag axes on construction. Refresh only when
    // switching from keyboard surface walking to a real pointer gesture.
    const view=viewport.current,alignForPointer=()=>{if(orbitUp.distanceToSquared(camera.up)>1e-10)align([camera.up.x,camera.up.y,camera.up.z],true);};
    if(wind){view.addEventListener('pointerdown',alignForPointer,true);view.addEventListener('wheel',alignForPointer,{capture:true,passive:true});}
    const setLens=(fov:number,zoom=1)=>{camera.fov=fov;camera.zoom=zoom;camera.updateProjectionMatrix();};
    // Only a successful explicit shot starts or replaces a close-up. Free
    // movement, orbit, wheel and folding the actor sheet leave the saved pair alone.
    const captureView=()=>({eye:camera.position.clone(),aim:orbit.target.clone(),up:[camera.up.x,camera.up.y,camera.up.z] as const,
      fov:camera.fov,zoom:camera.zoom,resumeGround:wind?.rememberGround(camera.position)});
    let bookmark:{view:ReturnType<typeof captureView>;focus:CloseUpFocus}|null=null;
    const forgetCloseUp=()=>{if(bookmark){bookmark=null;onCloseUpChange(null);}};
    const reset=()=>{forgetCloseUp();wind?.dispose();align();const [eye,look]=roomViews[scenery].entry;setLens(50);camera.position.set(...eye);orbit.target.set(...look);orbit.update();};
    const frame=()=>{
      const b=useBackpack.getState(), live=b.selected&&b.live[b.selected];if(!live)return;
      forgetCloseUp();wind?.dispose();
      if(scenery==='glassPlanet')align(); // imported actors stand on level stages
      setLens(50);const bounds=live.bounds, [x,y,z]=live.position;
      const target=new Vector3(...(bounds?.center??[x,y+.8,z]));
      const [w,h,d]=bounds?.size??[.65,1.6,.5];
      const dist=Math.min(20,Math.max(.4, .68*Math.max(h,Math.max(w,d)/Math.max(.15,camera.aspect))/Math.tan(camera.fov*Math.PI/360)+Math.max(w,d)*.5));
      const dir=camera.position.clone().sub(orbit.target).normalize();orbit.target.copy(target);camera.position.copy(target).addScaledVector(dir,dist);orbit.update();
    };
    // An explicit close look uses the two world objects the player can see.
    // A saved fit, a guessed fraction of actor height or a rail command can
    // all point at the wrong place when the actor is posed or the stand stows.
    const inspectStand=()=>{
      const {selected,live}=useBackpack.getState(),{active}=usePelvic.getState();
      if(!selected||active?.assetId!==selected||active.runtimeId!==live[selected]?.runtimeId||active.mode==='xrManual')return;
      const rig=scene.getObjectByName('pelvic:rig'),port=rig?.getObjectByName(`pelvic:adapter:${selected}`),piece=rig?.getObjectByName('pelvic:stand-piece');
      if(!rig?.visible||!port?.visible||!piece?.visible)return;
      forgetCloseUp();wind?.dispose();align();
      const at=port.getWorldPosition(new Vector3()),base=piece.getWorldPosition(new Vector3());
      const dir=new Vector3(.85,0,1).transformDirection(port.matrixWorld);dir.y=.16;dir.normalize();
      orbit.target.copy(at).lerp(base,.45);setLens(46);
      const distance=Math.max(.52,at.distanceTo(base)*1.7)/Math.min(1,Math.max(.35,camera.aspect));
      camera.position.copy(orbit.target).addScaledVector(dir,distance);orbit.update();
    };
    let releaseHints:(()=>void)|undefined;
    actions.current={reset,frame,inspectStand,upperBody(focus,assetId,runtimeId){
      const s=useMmdVrStore.getState(),b=useBackpack.getState(),live=b.live[assetId];
      if(!s.overlayOpen||s.presentation!=='screen'||s.prefs.scenery!==scenery||s.entryEpoch!==epoch||b.selected!==assetId||live?.runtimeId!==runtimeId||!live.visible)return;
      if(bookmark?.focus===focus){
        const {eye,aim,up,fov,zoom,resumeGround}=bookmark.view;
        wind?.dispose();align(up);setLens(fov,zoom);camera.position.copy(eye);orbit.target.copy(aim);orbit.update();
        resumeGround?.();
        forgetCloseUp();return;
      }
      const root=scene.children.find(o=>o.userData.mmdModelId===runtimeId);if(!root?.visible)return;
      const {eye,target}=upperBodyView(root,live,camera.aspect,focus);
      bookmark={view:bookmark?.view??captureView(),focus};
      wind?.dispose();align();setLens(40);orbit.target.copy(target);camera.position.copy(eye);orbit.update();onCloseUpChange(focus);
    },tour(index){const shot=tourShots(scenery)[index];if(!shot)return;
      wind?.dispose();
      if(shot.link){arrival.current={room:shot.link.to,eye:shot.eye,aim:shot.aim};if(!walkBetweenZones(shot.link))arrival.current=null;return;}
      forgetCloseUp();
      if(shot.preloadLawn&&!releaseHints)releaseHints=hintLawnPrints();
      align(shot.up);
      setLens(shot.overview?Math.min(130,Math.max(99,2*Math.atan(1.1/camera.aspect)*180/Math.PI)):shot.fov??50);camera.position.fromArray(shot.eye);orbit.target.fromArray(shot.aim);orbit.update();wind?.survey(camera.position,!!shot.up);},story(){if(isStoryRoom(scenery)){forgetCloseUp();const [eye,look]=storyViews[scenery];camera.position.set(...eye);orbit.target.set(...look);orbit.update();}},center(){const b=useBackpack.getState(),s=useMmdVrStore.getState();if(!b.draft||s.physicsBusy||s.assetLoad.running||s.physicsFatal)return;
      const prev=b.live[b.draft], transform=prev&&(s.models.find(m=>m.id===prev.runtimeId)??s.objects.find(o=>o.id===prev.runtimeId));
      const deck=scenery==='glassPlanet'?planetCenterDrop(camera.position):{x:0,z:0,y:undefined};
      if(!deck){useBackpack.setState({error:useLanguageStore.getState().t('planetCenterBlocked')});return;}
      b.confirmPlace(b.draft,deck.x,deck.z,transform?.rotationY??Math.atan2(camera.position.x-deck.x,camera.position.z-deck.z)*180/Math.PI,deck.y);
    }};
    reset();
    const a=arrival.current;arrival.current=null;
    if(a?.room===scenery){camera.position.fromArray(a.eye);orbit.target.fromArray(a.aim);orbit.update();}
    if(!a?.walking||a.room!==scenery)heldKeys.current.clear();
    orbit.enabled=canOrbit();
    keyboard.current=bindScreenCameraKeyboard(viewport.current,orbit,reset,travel,steps);
    const inputChanged=()=>{keyboard.current?.clear();orbit.enabled=canOrbit();};
    onReady(true);const off=useBackpack.subscribe((b,old)=>{
      if(old.draft!==b.draft)inputChanged();
      const id=b.selected;
      if(bookmark&&(old.selected!==id||!id||!b.live[id]?.visible||old.live[id]?.runtimeId!==b.live[id].runtimeId))forgetCloseUp();
    });
    // Observe crossings themselves: React can batch a round trip to the same room.
    const roomOff=useMmdVrStore.subscribe((s,p)=>{if(s.prefs.scenery!==p.prefs.scenery||s.entryEpoch!==p.entryEpoch)forgetCloseUp();});
    const poseOff=usePoseSession.subscribe((s,p)=>{if(s.dragging!==p.dragging)inputChanged();});
    return ()=>{view.removeEventListener('pointerdown',alignForPointer,true);view.removeEventListener('wheel',alignForPointer,true);keyboard.current?.dispose(arrival.current?.walking===true);keyboard.current=null;travel?.dispose();off();roomOff();poseOff();releaseHints?.();forgetCloseUp();actions.current=null;onReady(false);orbit.dispose();camera.up.set(0,1,0);};
  },[camera,gl,scene,scenery,epoch,actions,onReady,onCloseUpChange,viewport]);
  return null;
}
