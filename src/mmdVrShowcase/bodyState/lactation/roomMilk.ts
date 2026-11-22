import type { Object3D, Scene, WebGLRenderer } from 'three';
import { useBackpack } from '../../backpack';
import type { MmdRuntimeHandle } from '../../mmdRuntime/mmdRuntime';
import { useMmdVrStore } from '../../mmdVrStore';
import { useBodyState } from '../store';
import { createMilkDroplets } from './droplets';
import { subscribeMilkEffects } from './events';

type Runtime = Pick<MmdRuntimeHandle,'getModelRoot'|'sampleMilkOutlet'>;
const frameGap=.20;

/** Button offers arrive between renders. Only the last visible, evaluated
 * instance can accept one. No file, renderer, or active pose escapes this room. */
export function mountRoomMilk(scene:Scene, gl:WebGLRenderer, runtime:Runtime, isRoomStale:()=>boolean){
  let assetId:string|null=null, runtimeId:string|null=null, root:Object3D|null=null, lastFrame=-Infinity;
  let session:XRSession|null=null, ended:XRSession|null=null, contextLost=false, disposed=false;
  const profile=(s:ReturnType<typeof useBodyState.getState>,id=assetId)=>id?(s.draft?.assetId===id?s.draft.value:s.byAsset[id]):undefined;
  const drops=createMilkDroplets(scene,(side,pos,normal)=>{
    const p=profile(useBodyState.getState()),confirmed=side==='left'?p?.bareLeft:p?.bareRight;
    return !!runtimeId&&!!runtime.sampleMilkOutlet?.(runtimeId,side,pos,normal,confirmed===true);
  });
  function interrupt(){
    if(root)drops.clear();
    assetId=runtimeId=null;root=null;lastFrame=-Infinity;
  }
  function visibleRoot(id:string):Object3D|null {
    const actor=runtime.getModelRoot(id);
    for(let p=actor;p&&p.visible;p=p.parent)if(p===scene)return actor;
    return null;
  }
  function blocked(){
    const s=useMmdVrStore.getState(),b=useBackpack.getState();
    return disposed||contextLost||document.hidden||isRoomStale()||s.physicsBusy||s.physicsFatal||s.assetLoad.running||b.busy||!!b.draft;
  }
  function pending(id:string){const s=useMmdVrStore.getState();return s.pendingVisibilityToggles.includes(id)||s.pendingModelRemovals.includes(id);}
  const sessionEnded=()=>{ended=session;interrupt();};
  function bindSession(next:XRSession|null){
    if(next===session)return;
    interrupt();session?.removeEventListener('end',sessionEnded);session?.removeEventListener('visibilitychange',interrupt);
    session=next;ended=null;
    session?.addEventListener('end',sessionEnded);session?.addEventListener('visibilitychange',interrupt);
  }
  const lost=()=>{contextLost=true;interrupt();},restored=()=>{contextLost=false;interrupt();};
  gl.domElement?.addEventListener('webglcontextlost',lost);gl.domElement?.addEventListener('webglcontextrestored',restored);
  document.addEventListener('visibilitychange',interrupt);window.addEventListener('pagehide',interrupt);
  const stopBag=useBackpack.subscribe(b=>{
    if(!assetId)return;
    const live=b.live[assetId];
    if(b.busy||b.draft||b.selected!==assetId||live?.runtimeId!==runtimeId||!live.visible)interrupt();
  });
  const stopStage=useMmdVrStore.subscribe((s,p)=>{
    if(!root||!runtimeId)return;
    if(blocked()||pending(runtimeId)||s.presentation!==p.presentation||s.entryEpoch!==p.entryEpoch||s.physicsEnabled!==p.physicsEnabled)interrupt();
    else if(s.materialModels[runtimeId]!==p.materialModels[runtimeId])drops.advance(0);
  });
  const stopBody=useBodyState.subscribe((s,p)=>{
    if(!drops.active)return;
    const before=profile(p),after=profile(s);
    if(before?.bareLeft!==after?.bareLeft||before?.bareRight!==after?.bareRight)drops.advance(0);
  });
  const stopEvents=subscribeMilkEffects(e=>{
    if(e.kind==='clear'){if(e.assetId===assetId)drops.clear();return;}
    if(!root||e.assetId!==assetId||e.runtimeId!==runtimeId)return false;
    const b=useBackpack.getState(),live=b.live[e.assetId];
    if(blocked()||pending(e.runtimeId)||performance.now()-lastFrame>frameGap*1000||b.selected!==assetId||!live?.visible||live.runtimeId!==runtimeId||
      !b.entries.some(entry=>entry.id===assetId&&entry.kind==='model')||visibleRoot(e.runtimeId)!==root||gl.getContext?.().isContextLost()||
      (useMmdVrStore.getState().presentation==='xr'&&(!session||session===ended||gl.xr.getSession()!==session||session.visibilityState!=='visible'))){interrupt();return false;}
    return drops.emit(e.side,e.amount);
  });
  return {
    advance(dt:number,frame?:XRFrame){
      if(disposed)return;
      const b=useBackpack.getState(),id=b.selected,live=id&&b.live[id];
      // Ordinary stage roaming (including a selected, configured actor) does
      // not need an extra XR pose, root walk, or garment/skin sampling pass.
      if(!drops.active){
        const body=useBodyState.getState(),editing=id&&(body.inspection?.assetId===id||body.draft?.assetId===id);
        if(!editing||!profile(body,id)?.lactating){if(root)interrupt();return;}
      }
      if(!id||!live||!live.visible||!runtime.sampleMilkOutlet||blocked()||pending(live.runtimeId)||!(dt>=0&&dt<frameGap)){interrupt();return;}
      if(useMmdVrStore.getState().presentation==='xr'){
        if(!frame||!gl.xr?.isPresenting||gl.xr.getSession()!==frame.session){interrupt();return;}
        bindSession(frame.session);
        const space=gl.xr.getReferenceSpace();
        if(frame.session===ended||frame.session.visibilityState!=='visible'||!space||!frame.getViewerPose(space)){interrupt();return;}
      }else bindSession(null);
      const actor=visibleRoot(live.runtimeId),now=performance.now();
      if(actor!==root||id!==assetId||live.runtimeId!==runtimeId||now-lastFrame>frameGap*1000)interrupt();
      if(!actor)return;
      assetId=id;runtimeId=live.runtimeId;root=actor;lastFrame=now;
      drops.advance(dt);
    },
    dispose(){
      disposed=true;stopEvents();stopStage();stopBag();stopBody();bindSession(null);interrupt();drops.dispose();
      gl.domElement?.removeEventListener('webglcontextlost',lost);gl.domElement?.removeEventListener('webglcontextrestored',restored);
      document.removeEventListener('visibilitychange',interrupt);window.removeEventListener('pagehide',interrupt);
    },
  };
}
