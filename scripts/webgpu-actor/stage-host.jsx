import React from 'react';
import * as T from 'three/webgpu';
import {advance,createRoot,extend,unmountComponentAtNode,useFrame} from '@react-three/fiber';
import {DefaultXRInputSourceRayPointer,XR,XROrigin} from '@react-three/xr';
import {createAppXrStore} from '../../src/xr/createAppXrStore';
import {BackpackPlacement} from '../../src/mmdVrShowcase/backpack/BackpackPlacement';
import {HUD_RAY} from '../../src/mmdVrShowcase/hud/hudPointer';
import {MmdVrStageContent} from '../../src/mmdVrShowcase/stage/MmdVrStage';
import {StageEnvironment} from '../../src/mmdVrShowcase/stage/StageEnvironment';
import {resolveStageLighting} from '../../src/mmdVrShowcase/stage/lighting';
import {getMmdVrRenderProfile} from '../../src/mmdVrShowcase/settings/mmdVrQuality';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';
import {prepareBackpackEntry,useBackpack} from '../../src/mmdVrShowcase/backpack/store';
import {beginMmdVrAssetSession} from '../../src/mmdVrShowcase/backpack/sessionAssets';
import {bindR187ProjectionOutput} from './r187ProjectionOutput.js';
import {createStageActorBackend} from './stageActorBackend.js';
import {stageControls} from './stage-controls.js';
import {trackedContacts} from './stage-tracked-contacts.js';
import {usePlayerMovement} from '../../src/mmdVrShowcase/movement/usePlayerMovement';

// Only this developer entry imports the WebGPU implementation. R3F renders
// the product room on Three's native XR callback, never a second RAF.
extend(T);
// Keep the game's XR pointer and drop surface (including the footprint and
// release checks). No test-specific hit test, drop coordinate or input event.
function StageRay(){
  const aiming=useBackpack(s=>!!s.draft);
  return <DefaultXRInputSourceRayPointer makeDefault minDistance={.2} rayModel={aiming?HUD_RAY.rayModel:false} cursorModel={false}/>;
}
function FloorPlayer({origin,contacts}){
  // This host already assigns the lower right face button to the VMD transport.
  usePlayerMovement(origin,false,{jumpOnPrimary:false});
  useFrame(({gl},_,frame)=>{
    if(origin.current && frame)contacts.sample(frame,gl.xr.getReferenceSpace(),origin.current.matrixWorld,useMmdVrStore.getState().prefs.physicsColliderRadius);
  },-1);
  return <XROrigin ref={origin}/>;
}
export function startStageHost(selection,onStatus) {
  const controls=stageControls(selection),contacts=trackedContacts(),origin=React.createRef(),log={phase:'request',frames:0};
  let closing=false,committed=false,session,ended=false,renderer,root,store,xrStore,backend,undo,epoch;
  let timer,backendTask,resolveStop,prevTime,elapsed=0;
  const stopped=new Promise(r=>resolveStop=r);
  const publish=phase=>{log.phase=phase;onStatus();};
  const snapshot=()=>useBackpack.getState().layouts.floor ?? (useMmdVrStore.getState().savedStage?.scenery==='floor'?useMmdVrStore.getState().savedStage:null);
  function stop(error){
    if(closing)return;
    if(error)log.error=String(error?.message??error);
    closing=true;clearTimeout(timer);controls.reset();
    if(committed && useMmdVrStore.getState().entryEpoch===epoch){
      contacts.reset();
      // Snapshot while the live room and its actor still exist.
      useMmdVrStore.getState().closeOverlay();
    }
    resolveStop();
  }
  function interrupt(cancelDraft=true){
    prevTime=undefined;controls.reset();
    if(committed){
      contacts.reset();
      // A release after tracking or focus returns must not place a held draft.
      const bag=useBackpack.getState();if(cancelDraft&&bag.draft)bag.cancelPlace();
    }
    backend?.beginFrame(null,null,true);
  }
  const endedSession=()=>{ended=true;stop();};
  const onError=e=>stop(e.error??e.message), pageHide=()=>stop();
  async function run(){
    try {
      if(T.REVISION!=='187'||!navigator.xr||!navigator.gpu||!globalThis.XRGPUBinding)throw Error('WebGPU XR 不可用');
      const saved=snapshot();
      if(saved && (saved.assets.length>1 || saved.objects.length || saved.assets.some(s=>s.kind!=='model')))throw Error('请在普通舞台把摄影地台整理为至多一位角色再进入。');
      // Request from the original click. Until a tracked draw succeeds, no
      // page state, previous scene or asset binding is changed.
      session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['webgpu','local-floor'],optionalFeatures:['hand-tracking']});
      session.addEventListener('end',endedSession);session.addEventListener('visibilitychange',interrupt);
      if(closing)return;
      if(!session.enabledFeatures?.includes('webgpu'))throw Error('Session did not enable WebGPU');
      window.addEventListener('error',onError);window.addEventListener('pagehide',pageHide);
      publish('init');
      renderer=new T.WebGPURenderer({antialias:false});
      renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
      renderer.onDeviceLost=info=>stop(`device lost: ${info.message}`);
      renderer.onError=info=>stop(`${info.type}: ${info.message}`);
      await renderer.init();if(closing)return;
      if(!renderer.backend.isWebGPUBackend)throw Error('WebGPU adapter unavailable');
      undo=bindR187ProjectionOutput(renderer);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.05,40),sun=React.createRef();
      const prefs=useMmdVrStore.getState().prefs;
      root=createRoot(renderer.domElement);
      await root.configure({gl:renderer,scene,camera,frameloop:'never',dpr:1,size:{width:320,height:320,top:0,left:0}});
      if(closing)return;
      store=root.render(<StageEnvironment scenery="floor" prefs={prefs} profile={getMmdVrRenderProfile(prefs)} lighting={resolveStageLighting(prefs.lightPreset,{})} sunRef={sun}/>);
      // R3F's default sessionstart handler targets WebGL's xr.setAnimationLoop.
      // With an external r187 renderer, XRManager itself owns setSession + RAF.
      store.getState().xr.disconnect();
      xrStore=createAppXrStore({controller:StageRay});xrStore.setHand(StageRay);
      // Bind input state before sessionstart, mount pointer elements only
      // after the first tracked draw. Three still owns the only projection layer.
      xrStore.setWebXRManager(renderer.xr);
      await renderer.setAnimationLoop((time,frame)=>{
        if(closing || !frame || frame.session!==session || !renderer.xr.isPresenting)return;
        try{
          if(session.visibilityState!=='visible'||!frame.getViewerPose(renderer.xr.getReferenceSpace())?.views.length){interrupt();return;}
          const dt=prevTime==null?0:(time-prevTime)*.001;prevTime=time;
          if(dt<0||dt>.25)interrupt(false);else elapsed+=dt;
          if(committed)controls.sample(session.inputSources);
          advance(elapsed,false,store.getState(),frame);
          if(closing)return;
          if(++log.frames===1){
            // No actor, shader compile for PMX, or physics startup on the
            // critical path to the first pair of environment images.
            clearTimeout(timer);
            backendTask=createStageActorBackend(renderer,scene,sun.current,origin).then(b=>{
              backend=b;if(closing)return;
              const state=useMmdVrStore.getState();
              if(state.overlayOpen)throw Error('Another stage is active');
              prepareBackpackEntry(true);beginMmdVrAssetSession(saved?.assets??[]);
              if(state.prefs.scenery!=='floor')state.setPrefs({scenery:'floor'});
              state.openOverlay('xr');epoch=useMmdVrStore.getState().entryEpoch;committed=true;
              useMmdVrStore.setState({phase:'active',resumeStage:saved,physicsEnabled:saved?.physicsEnabled??true,physicsDebugEnabled:true});
              // XR's sessionstart happened before this subtree mounted. Its
              // pointer portal and Three's eye update both use camera.parent.
              store.setState({camera:renderer.xr.getCamera()});
              root.render(<XR store={xrStore}><FloorPlayer origin={origin} contacts={contacts}/><MmdVrStageContent backend={b}/><BackpackPlacement/></XR>);
            }).catch(stop);
          }
          if(committed&&log.phase!=='active'&&useMmdVrStore.getState().captureStage)publish('active');
        }catch(e){stop(e);}
      });
      if(closing)return;
      publish('bind');timer=setTimeout(()=>stop(Error('No first tracked draw within 15 s')),15000);
      await renderer.xr.setSession(session);
      if(!closing&&!log.frames)publish('waiting');
      await stopped;
    }catch(e){stop(e);}
    finally{
      closing=true;clearTimeout(timer);
      const release=async fn=>{try{await fn();}catch(e){log.error??=String(e);}};
      if(session && !ended)await release(()=>session.end());
      await release(()=>backendTask);
      if(root)await release(()=>new Promise(resolve=>unmountComponentAtNode(renderer.domElement,resolve)));
      await release(()=>xrStore?.destroy());
      await release(()=>backend?.dispose());await release(()=>undo?.());await release(()=>renderer?.dispose());
      session?.removeEventListener('end',endedSession);session?.removeEventListener('visibilitychange',interrupt);
      window.removeEventListener('error',onError);window.removeEventListener('pagehide',pageHide);
      publish(log.error?'failed':'ended');
    }
  }
  const done=run();
  return {done,stop,get status(){
    const s=useMmdVrStore.getState();return {...log,actor:backend?.status??null,bulletSteps:s.physicsStepCount,dynamicBodies:s.physicsDynamicBodyCount};
  }};
}
