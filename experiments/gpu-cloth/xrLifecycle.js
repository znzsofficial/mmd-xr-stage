import {eyeName,xrError} from './xrReceipts.js';

// https://immersive-web.github.io/webxr-samples/webgpu/vr-barebones.html
// https://immersive-web.github.io/webxr-webgpu-binding/#xrgpuprojectionlayerinit
// Every asynchronous continuation belongs to one attempt. The application never
// waits for end(), frame-rate negotiation, pipeline compilation or GPU completion
// to release the screen or to schedule another XR callback.
export function clothXR({receipts,requestSession,makeBinding,makeTargets,prepareActor,draw,changed,acquired,returned,trackingGap}){
  let current=null,awaitingScreen=null;
  function phase(r,p){if(r.data.phase!==p){r.data.phase=p;changed(r.data);}}
  function observeEnd(r){r.data.endObserved=true;r.first('endEvent');}
  function endSession(s,r){
    try{Promise.resolve(s.end()).then(()=>r.first('endResolved'),e=>{r.data.endError=xrError('end',e);});}
    catch(e){r.data.endError=xrError('end',e);}
  }
  function retire(r,reason,error){
    if(r!==current)return;
    const s=r.session;current=null;awaitingScreen=r;
    r.data.endReason=reason;r.data.error=error??null;r.first('retired');
    if(s){
      if(r.raf!=null)try{s.cancelAnimationFrame?.(r.raf);}catch{/* Session already ended. */}
      try{r.targets?.dispose();}catch(e){r.data.cleanupError=xrError('targets-dispose',e);}
      try{r.layer?.destroy?.();}catch{/* UA may have invalidated the layer. */}
    }
    r.targets=r.layer=r.space=r.session=null;
    if(s&&!r.data.endObserved)endSession(s,r);
    phase(r,error?'failed':'ended');returned(!!s);
  }
  function fail(r,stage,e){retire(r,'error',xrError(stage,e));}
  // Scopes pop synchronously before a different owner can touch this device. In
  // particular a late XR validation result cannot stop a new session or the screen.
  function scoped(r,stage,work,validated){
    const d=r.device;d.pushErrorScope('validation');let completed=false;
    try{const result=work();completed=true;return result;}finally{d.popErrorScope().then(error=>{
      if(error){r.data.validationError=xrError(stage,error);fail(r,stage,error);}
      else if(completed)validated?.();
    },e=>fail(r,stage,e));}
  }
  function prepare(r){
    r.data.actorState='preparing';r.first('actorPrepare');
    Promise.resolve().then(()=>current===r&&prepareActor(r.format)).then(()=>{
      if(current!==r)return;r.data.actorState='ready';r.first('actorReady');changed(r.data);
    },e=>{if(current!==r)return;r.data.actorState='failed';r.data.actorError=xrError('actor-prepare',e);changed(r.data);});
  }
  function requestRate(r,s){
    try{
      if(!s.supportedFrameRates?.includes(72)||!s.updateTargetFrameRate)return;
      r.data.rate72='pending';r.first('rateRequest');
      Promise.resolve(s.updateTargetFrameRate(72)).then(()=>{if(current===r)r.data.rate72='accepted';},()=>{if(current===r)r.data.rate72='rejected';});
    }catch{r.data.rate72='rejected';}
  }
  async function enter(device){
    if(current)return;
    const r=current=Object.assign(receipts.begin(),{device});changed(r.data);let stage='request';
    try{
      // Directly from the click, while transient user activation is available.
      const s=await requestSession('immersive-vr',{requiredFeatures:['webgpu','local-floor'],optionalFeatures:['hand-tracking']});
      s.addEventListener('end',()=>{observeEnd(r);retire(r,'session-end');},{once:true});
      r.first('session');if(current!==r){endSession(s,r);return;}
      r.session=s;awaitingScreen=null;acquired();phase(r,'initializing');
      stage='binding';const binding=makeBinding(s,device);r.format=binding.getPreferredColorFormat();r.first('binding');
      stage='layer';try{r.layer=binding.createProjectionLayer({colorFormat:r.format,depthStencilFormat:'depth24plus'});}
      catch(e){if(e?.name!=='NotSupportedError')throw e;r.first('retryWithoutDepth');r.layer=binding.createProjectionLayer({colorFormat:r.format});}
      r.first('layer');stage='render-state';s.updateRenderState({layers:[r.layer]});r.first('renderState');
      stage='targets';r.targets=scoped(r,'targets-validation',()=>makeTargets(device,binding,r.layer));
      stage='reference-space';r.first('referenceRequest');const space=await s.requestReferenceSpace('local-floor');
      if(current!==r)return;r.space=space;r.first('referenceSpace');
      const onFrame=(time,frame)=>{
        if(current!==r||frame.session!==s)return;
        r.raf=null;let at='schedule';const d=r.data,f=d.frames;
        try{
          f.callbacks++;r.first('callback');r.raf=s.requestAnimationFrame(onFrame);
          d.visibility=['visible','visible-blurred','hidden'].includes(s.visibilityState)?s.visibilityState:'unknown';
          d.refreshHz=Number.isFinite(s.frameRate)?s.frameRate:null;
          at='pose';const hidden=d.visibility==='hidden',pose=!hidden&&frame.getViewerPose(space);
          if(pose){f.posed++;r.first('pose');}
          if(!pose||!pose.views.length){
            const gap=hidden?'hidden':!pose?'noPose':'noViews';f[gap]++;r.first(gap);
            d.lastPoseEyes.length=0;if(!r.gap){trackingGap();r.gap=true;}phase(r,gap);return;
          }
          r.gap=false;const poses=pose.views;
          at='subimage';if(poses.length>2)throw RangeError();
          d.lastPoseEyes.length=poses.length;for(let i=0;i<poses.length;i++)d.lastPoseEyes[i]=eyeName(poses[i].eye);
          scoped(r,'frame-validation',()=>{
            const targets=r.targets.views(poses);if(targets.length!==poses.length)throw RangeError();r.views(poses,targets);
            at='draw';const withActor=d.actorState==='ready';let submitted=false;
            draw({time,frame,space,poses,targets,withActor,inputs:r.inputs,submit(encoder){
              at='finish';const commands=encoder.finish();at='submit';device.queue.submit([commands]);
              // A returned submit is evidence of JS submission, not composition or visibility.
              submitted=true;r.submitted(withActor);at='draw';
            }});
            if(!submitted){at='submit';throw Error('No XR commands submitted');}
            phase(r,withActor?'actor':'landmark');
          },()=>{f.validationPassed++;r.first('validationPassed');});
          if(d.actorState==='not-started')prepare(r);
        }catch(e){fail(r,at,e);}
      };
      stage='schedule';r.raf=s.requestAnimationFrame(onFrame);r.first('scheduled');phase(r,'awaiting-frame');requestRate(r,s);
    }catch(e){fail(r,stage,e);}
  }
  return {enter,get busy(){return !!current;},get session(){return current?.session;},
    close(reason='user-exit'){if(current)retire(current,reason);},
    fault(stage,e){if(!current)return false;fail(current,stage,e);return true;},
    screenSubmitted(){if(awaitingScreen){awaitingScreen.data.screenResumed=true;awaitingScreen.first('screenSubmit');awaitingScreen=null;}}};
}
