import React from 'react';
import * as THREE from 'three';
import * as T from 'three/webgpu';
import {advance,createRoot,extend,unmountComponentAtNode,useFrame} from '@react-three/fiber';
import {DefaultXRInputSourceRayPointer,XR,XROrigin} from '@react-three/xr';
import {createAppXrStore} from '../../src/xr/createAppXrStore';
import {MmdVrGameRoom} from '../../src/mmdVrShowcase/xr/MmdVrGameRoom';
import {bindHandVisibility} from '../../src/mmdVrShowcase/xr/handVisibility';
import {clearMmdVrControllerColliders} from '../../src/mmdVrShowcase/xr/contact/controllerSlots';
import {clearMmdVrHandColliders} from '../../src/mmdVrShowcase/xr/contact/handSlots';
import {BackpackPlacement} from '../../src/mmdVrShowcase/backpack/BackpackPlacement';
import {HUD_RAY} from '../../src/mmdVrShowcase/hud/hudPointer';
import {MmdVrStageContent} from '../../src/mmdVrShowcase/stage/MmdVrStage';
import {StageEnvironment} from '../../src/mmdVrShowcase/stage/StageEnvironment';
import {resolveStageLighting} from '../../src/mmdVrShowcase/stage/lighting';
import {getMmdVrRenderProfile} from '../../src/mmdVrShowcase/settings/mmdVrQuality';
import {minSceneViewDistance} from '../../src/mmdVrShowcase/settings/mmdVrAdjustments';
import {describeRenderRequest} from '../../src/mmdVrShowcase/diagnostics/renderDiagnostics';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';
import {prepareBackpackEntry,useBackpack} from '../../src/mmdVrShowcase/backpack/store';
import {beginMmdVrAssetSession} from '../../src/mmdVrShowcase/backpack/sessionAssets';
import {bindR187ProjectionOutput} from './r187ProjectionOutput.js';
import {gameHudRay} from './gameHudRay.js';
import {createStageActorBackend} from './stageActorBackend.js';
import {stageControls} from './stage-controls.js';
import {recordFloorPerformance} from './floorPerformance.js';
import {createFloorGpuTiming} from './floorGpuTiming.js';
import {takeFloorRenderer,returnFloorRenderer,bindFloorSession,requestFloorDisplay} from './floorRenderer.js';
import {DaylightMaterials} from '../../src/mmdVrShowcase/scenery/daylightMaterials';
import {roomSets} from '../../src/mmdVrShowcase/scenery/roomSets';
import {supportsWebgpuRoom,fitsWebgpuRoom} from '../../src/mmdVrShowcase/xr/floorBackend';
import {classroomMaterials} from './classroomMaterials.jsx';
import {trackedContacts} from './stage-tracked-contacts.js';
import {usePlayerMovement} from '../../src/mmdVrShowcase/movement/usePlayerMovement';
import {releaseMilk,useMilkInteraction} from '../../src/mmdVrShowcase/bodyState/lactation/interaction';
import {interruptPelvic,usePelvic} from '../../src/mmdVrShowcase/pelvic/store';
import {stopRemoteEgg} from '../../src/mmdVrShowcase/play/remote/remoteMotor';
import {stopWand} from '../../src/mmdVrShowcase/play/wandMotor';

// Input bindings for the old internal regression page only.
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

function FloorShadows({renderer}){
  const prefs=useMmdVrStore(s=>s.prefs),enabled=getMmdVrRenderProfile(prefs).shadows;
  React.useLayoutEffect(()=>{renderer.shadowMap.enabled=enabled;},[renderer,enabled]);
  return null;
}
export function startStageHost(selection,onStatus) {
  return startFloor({resume:true,onStatus,fixture:{controls:stageControls(selection),contacts:trackedContacts()}});
}

export function startGameFloor({resume=false,onStatus}) {
  return startFloor({resume,onStatus});
}

function startFloor({resume,onStatus,fixture}) {
  const origin=React.createRef(),log={phase:'request',frames:0};
  const initialEpoch=useMmdVrStore.getState().entryEpoch;
  const entryState=useMmdVrStore.getState(),entryRoom=fixture?'floor':resume?entryState.savedStage?.scenery:entryState.prefs.scenery;
  let closing=false,committed=false,session,ended=false,ending,renderer,root,store,xrStore,backend,undo,unbindHands,epoch;
  let timer,backendTask,resolveStop,resolveEarly,prevTime,elapsed=0,pageRetired=false,lost=false,gpuTiming;
  const profile=getMmdVrRenderProfile(entryState.prefs),requested=describeRenderRequest(entryState.prefs);
  const recording=fixture?null:recordFloorPerformance(performance.now(),requested);
  const stopped=new Promise(r=>resolveStop=r);
  const earlyExit=new Promise(r=>resolveEarly=r);
  const publish=phase=>{if(log.phase!==phase){log.phase=phase;onStatus?.();}};
  function readLayout(){
    const state=useMmdVrStore.getState();
    if(state.overlayOpen || state.entryEpoch!==initialEpoch)throw Error('Another stage was opened');
    if(!supportsWebgpuRoom(entryRoom) || (!fixture && state.prefs.scenery!==entryState.prefs.scenery))throw Error('Room selection changed before entry');
    if(!resume)return null;
    const layout=useBackpack.getState().layouts[entryRoom], saved=state.savedStage?.scenery===entryRoom?state.savedStage:null;
    if(!fitsWebgpuRoom(layout??saved))throw Error('保存的布局超过舞台的角色或物件上限。');
    return layout??saved;
  }
  // A cancelled permission prompt can still resolve after the next click.
  // End only the XRSession obtained by this invocation.
  function endOwnSession(){
    if(session && !ended && !ending){
      const own=session;
      ending=Promise.resolve().then(()=>own.end()).catch(e=>{log.error??=String(e);});
    }
    return ending;
  }
  function clearContacts(){
    if(fixture)fixture.contacts.reset();
    else {clearMmdVrControllerColliders();clearMmdVrHandColliders();}
  }
  function stop(error){
    if(closing)return;
    if(error){
      const actor=backend?.status,s=useMmdVrStore.getState();
      log.error=`${error?.message??error} [${resume?'resume':'fresh'}; phase=${log.phase}; trackedDraws=${log.frames}; room=${committed?'mounted':'pending'}; loading=${committed&&s.assetLoad.running}; actor=${actor?.evaluations?'evaluated':actor?.style?'attached':'none'}]`;
    }
    closing=true;clearTimeout(timer);fixture?.controls.reset();gpuTiming?.interrupt();
    if(committed && useMmdVrStore.getState().entryEpoch===epoch){
      if(!error)recording?.finish();
      clearContacts();
      // Snapshot while the live room and its actor still exist.
      useMmdVrStore.getState().closeOverlay();
    }
    resolveStop();
    if(!committed){
      // An unanswered permission dialog owns no session. Once granted, end the
      // session now; don't offer another immersive entry while it is retiring.
      void endOwnSession();
      if(!session){publish(log.error?'failed':'ended');resolveEarly();}
    }
  }
  function interrupt(cancelDraft=true){
    if(closing)return;
    if(cancelDraft!==false){recording?.interrupt();gpuTiming?.interrupt();} // a long *visible* interval is a real stall
    prevTime=undefined;fixture?.controls.reset();
    if(committed){
      clearContacts();
      // A frame with no viewer pose never reaches the Fiber room. Even a
      // one-frame loss must retire the captured trigger before recovery.
      releaseMilk(useMilkInteraction.getState().hold);
      if(cancelDraft!==false){ // A slow but still tracked frame is not a tracking loss.
        stopRemoteEgg();
        stopWand();
      }
      const stand=usePelvic.getState().active;if(stand)interruptPelvic(stand.token);
      // A release after tracking or focus returns must not place a held draft.
      const bag=useBackpack.getState();if(cancelDraft&&bag.draft)bag.cancelPlace();
    }
    backend?.beginFrame(null,null,true);
  }
  const endedSession=()=>{ended=true;stop();};
  const onError=e=>stop(e.error??e.message), pageHide=()=>{pageRetired=true;stop();};
  async function run(){
    try {
      if(T.REVISION!=='187'||!navigator.xr||!navigator.gpu||!globalThis.XRGPUBinding)throw Error('WebGPU XR 不可用');
       readLayout();
       recording?.begin();
      window.addEventListener('pagehide',pageHide);
      // Request from the original click. Until a tracked draw succeeds, no
      // page state, previous scene or asset binding is changed.
      const request=navigator.xr.requestSession('immersive-vr',{requiredFeatures:['webgpu','local-floor'],optionalFeatures:['hand-tracking']});
      await Promise.race([request.then(granted=>{
        session=granted;
        if(closing){void endOwnSession();return;}
        session.addEventListener('end',endedSession);session.addEventListener('visibilitychange',interrupt);
      }),stopped]);
      if(closing)return;
      if(!session.enabledFeatures?.includes('webgpu'))throw Error('Session did not enable WebGPU');
      window.addEventListener('error',onError);
      publish('init');if(closing)return;
      timer=setTimeout(()=>stop(Error('No first tracked draw within 15 s')),15000);
      renderer=await takeFloorRenderer(!fixture && requested.antialias);
      if(closing)return;
      renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
      renderer.onDeviceLost=info=>{lost=true;stop(`device lost: ${info.message}`);};
      renderer.onError=info=>stop(`${info.type}: ${info.message}`);
      await renderer.init();if(closing)return;
      if(!renderer.backend.isWebGPUBackend)throw Error('WebGPU adapter unavailable');
      if(recording && new URLSearchParams(location.search).get('gpuTiming')==='1')gpuTiming=createFloorGpuTiming(renderer);
      undo=bindR187ProjectionOutput(renderer);
      const prefs=useMmdVrStore.getState().prefs;
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.05,Math.max(minSceneViewDistance(entryRoom),prefs.viewDistance)),sun=React.createRef();
      const lighting=resolveStageLighting(prefs.lightPreset,roomSets[entryRoom]);
      extend(THREE); // Same JSX constructors as the product Canvas; no registry edits on preload.
      root=createRoot(renderer.domElement);
      await root.configure({gl:renderer,scene,camera,frameloop:'never',dpr:1,size:{width:320,height:320,top:0,left:0}});
      if(closing)return;
      renderer.shadowMap.enabled=profile.shadows;
      renderer.shadowMap.type=T.PCFShadowMap;
      renderer.toneMapping=prefs.softHighlights?T.NeutralToneMapping:T.LinearToneMapping;
      renderer.toneMappingExposure=prefs.exposure;
      store=root.render(<DaylightMaterials.Provider value={classroomMaterials}><StageEnvironment scenery={entryRoom} prefs={prefs} profile={profile} lighting={lighting} sunRef={sun}/></DaylightMaterials.Provider>);
      // R3F's default sessionstart handler targets WebGL's xr.setAnimationLoop.
      // With an external r187 renderer, XRManager itself owns setSession + RAF.
      store.getState().xr.disconnect();
      xrStore=createAppXrStore({controller:fixture?StageRay:{rayPointer:gameHudRay}});
      if(fixture)xrStore.setHand(StageRay);else unbindHands=bindHandVisibility(xrStore,gameHudRay);
      // Bind input state before sessionstart, mount pointer elements only
      // after the first tracked draw. Three still owns the only projection layer.
      xrStore.setWebXRManager(renderer.xr);
      await renderer.setAnimationLoop((time,frame)=>{
        if(closing || !frame || frame.session!==session || !renderer.xr.isPresenting)return;
        try{
          const views=session.visibilityState==='visible' && frame.getViewerPose(renderer.xr.getReferenceSpace())?.views;
          if(!views?.length){interrupt();return;}
          const dt=prevTime==null?0:(time-prevTime)*.001;prevTime=time;
          if(dt<0||dt>.25)interrupt(false);else elapsed+=dt;
          if(!log.frames && !sun.current)return; // Fiber must have committed the landmark floor.
          if(committed)fixture?.controls.sample(session.inputSources);
          const gpuPasses=gpuTiming && committed && recording.sampleDue(time) ? gpuTiming.begin(views.length) : undefined;
          advance(elapsed,false,store.getState(),frame);
          if(gpuPasses)gpuTiming.end();
          if(closing)return;
          recording?.draw(time,frame,views,renderer,committed?backend:null,entryRoom,gpuPasses);
          if(++log.frames===1){
            // No actor, shader compile for PMX, or physics startup on the
            // critical path to the first pair of environment images.
            clearTimeout(timer);
            // Mirror the product's rate policy after the first tracked draw.
            if(!fixture)requestFloorDisplay(session,profile,requested);
            timer=setTimeout(()=>stop(Error('Stage did not become ready after the first draw')),15000);
            const grade=fixture?undefined:{balancedModelColor:prefs.balancedModelColor,ambientIntensity:lighting.ambient};
            backendTask=createStageActorBackend(renderer,scene,sun.current,origin,grade,gpuTiming).then(b=>{
              backend=b;if(closing)return;
              const saved=readLayout();
              const state=useMmdVrStore.getState();
               beginMmdVrAssetSession(saved?.assets??[],'webgpu');
              prepareBackpackEntry(resume);
              if(state.prefs.scenery!==entryRoom)state.setPrefs({scenery:entryRoom});
              state.openOverlay('xr');epoch=useMmdVrStore.getState().entryEpoch;committed=true;
              useMmdVrStore.setState({phase:'active',resumeStage:saved,...(!resume&&{savedStage:null}),
                physicsEnabled:saved?.physicsEnabled??true,...(fixture&&{physicsDebugEnabled:true})});
              // XR's sessionstart happened before this subtree mounted. Its
              // pointer portal and Three's eye update both use camera.parent.
              store.setState({camera:renderer.xr.getCamera()});
               root.render(<DaylightMaterials.Provider value={classroomMaterials}><FloorShadows renderer={renderer}/><XR store={xrStore}>{fixture?<><FloorPlayer origin={origin} contacts={fixture.contacts}/><MmdVrStageContent backend={b}/><BackpackPlacement/></>:
                <MmdVrGameRoom originRef={origin} backend={b} onExit={stop} busy={false}/>}</XR></DaylightMaterials.Provider>);
            }).catch(stop);
          }
          if(committed&&log.phase!=='active'&&useMmdVrStore.getState().captureStage){clearTimeout(timer);publish('active');}
        }catch(e){stop(e);}
      });
      if(closing)return;
      publish('bind');if(closing)return;
      await bindFloorSession(renderer.xr,session,fixture?null:requested.framebufferScale);
      if(!closing&&!log.frames)publish('waiting');
      await stopped;
    }catch(e){stop(e);}
    finally{
      closing=true;clearTimeout(timer);
      const release=async fn=>{try{await fn();}catch(e){log.error??=String(e);}};
      await release(endOwnSession);
      await release(()=>backendTask);
      if(root)await release(()=>new Promise(resolve=>unmountComponentAtNode(renderer.domElement,resolve)));
      unbindHands?.();
      await release(()=>xrStore?.destroy());
      await release(()=>backend?.dispose());await release(()=>undo?.());
      gpuTiming?.dispose();
      recording?.dispose();
      if(renderer)await release(()=>returnFloorRenderer(renderer,committed&&!lost&&!pageRetired&&!log.error));
      session?.removeEventListener('end',endedSession);session?.removeEventListener('visibilitychange',interrupt);
      window.removeEventListener('error',onError);window.removeEventListener('pagehide',pageHide);
      publish(log.error?'failed':'ended');
    }
  }
  const done=Promise.race([run(),earlyExit]);
  return {done,stop,get status(){
    const s=useMmdVrStore.getState();return {...log,actor:backend?.status??null,bulletSteps:s.physicsStepCount,dynamicBodies:s.physicsDynamicBodyCount};
  }};
}
