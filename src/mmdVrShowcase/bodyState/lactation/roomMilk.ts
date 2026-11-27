import {Vector3, type Object3D, type Scene, type WebGLRenderer} from 'three';
import { useBackpack } from '../../backpack/store';
import {useHudWorldInput} from '../../hud/hudWorldInput';
import type { MmdRuntimeHandle } from '../../mmdRuntime/mmdRuntime';
import { useMmdVrStore } from '../../mmdVrStore';
import {debitActorMilk, useBodyState} from '../store';
import { createMilkDroplets } from './droplets';
import type {OutletDetail} from './outlets';
import { subscribeMilkEffects } from './events';
import {publishOutlets, releaseMilk, retireMilkReading, useMilkInteraction, type MilkPanel, type OutletState, type Side} from './interaction';

type Runtime = Pick<MmdRuntimeHandle,'getModelRoot'|'sampleMilkOutlet'>;
const frameGap=.50,betweenFramesMaxAge=.20;
const sides=['left','right'] as const, beat=.16, dose=.034;

/** Button offers arrive between renders. Only the last visible, evaluated
 * instance can accept one. No file, renderer, or active pose escapes this room. */
export function mountRoomMilk(scene:Scene, gl:WebGLRenderer, runtime:Runtime, isRoomStale:()=>boolean){
  let assetId:string|null=null, runtimeId:string|null=null, root:Object3D|null=null, lastFrame=-Infinity;
  let session:XRSession|null=null, ended:XRSession|null=null, contextLost=false, disposed=false;
  const room={},interaction=useMilkInteraction.getState;
  let lastProbe=-Infinity,previousHold:ReturnType<typeof interaction>['hold']=null,elapsed=0;
  const flowing={left:false,right:false};
  const profile=(s:ReturnType<typeof useBodyState.getState>,id=assetId)=>id?(s.draft?.assetId===id?s.draft.value:s.byAsset[id]):undefined;
  // Read each skinned/occlusion result once per evaluated frame. Between
  // frames (legacy presses or material changes) always take a fresh sample.
  const port=()=>({frame:-1,ok:false,pos:new Vector3(),axis:new Vector3(),detail:{} as OutletDetail});
  const samples={left:[port(),port()],right:[port(),port()]};let evaluating=false,stamp=0;
  function sample(side:Side,confirmed:boolean,pos:Vector3,axis:Vector3,size?:{span?:number}){
    const cache=samples[side][Number(confirmed)];
    if(!evaluating||cache.frame!==stamp){
      cache.pos.setScalar(NaN);cache.axis.setScalar(NaN);cache.frame=evaluating?stamp:-1;
      cache.detail.state=undefined;cache.detail.span=undefined;
      cache.ok=!!runtimeId&&!!runtime.sampleMilkOutlet?.(runtimeId,side,cache.pos,cache.axis,confirmed,cache.detail)&&
        Number.isFinite(cache.pos.lengthSq()+cache.axis.lengthSq())&&cache.axis.lengthSq()>1e-12;
    }
    if(cache.ok){pos.copy(cache.pos);axis.copy(cache.axis);if(size)size.span=cache.detail.span;}return cache.ok;
  }
  const drops=createMilkDroplets(scene,(side,pos,normal,size)=>{
    const p=profile(useBodyState.getState()),confirmed=side==='left'?p?.bareLeft:p?.bareRight;
    return sample(side,confirmed===true,pos,normal,size);
  });
  function interrupt(){
    if(root)drops.clear();
    retireMilkReading(room);previousHold=null;lastProbe=-Infinity;elapsed=0;
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
  const sourceEnded=(e:XRInputSourceEvent)=>{const s=interaction();if(s.reading?.room===room&&s.hold?.source===e.inputSource)releaseMilk(s.hold,true);};
  const sourceChanged=(e:XRInputSourcesChangeEvent)=>{const s=interaction();if(s.reading?.room===room&&s.hold?.source&&e.removed.includes(s.hold.source))releaseMilk(s.hold);};
  function bindSession(next:XRSession|null){
    if(next===session)return;
    interrupt();session?.removeEventListener('end',sessionEnded);session?.removeEventListener('visibilitychange',interrupt);
    session?.removeEventListener('selectend',sourceEnded);session?.removeEventListener('inputsourceschange',sourceChanged);
    session=next;ended=null;
    session?.addEventListener('end',sessionEnded);session?.addEventListener('visibilitychange',interrupt);
    session?.addEventListener('selectend',sourceEnded);session?.addEventListener('inputsourceschange',sourceChanged);
  }
  const lost=()=>{contextLost=true;interrupt();},restored=()=>{contextLost=false;interrupt();};
  gl.domElement?.addEventListener('webglcontextlost',lost);gl.domElement?.addEventListener('webglcontextrestored',restored);
  document.addEventListener('visibilitychange',interrupt);window.addEventListener('pagehide',interrupt);window.addEventListener('blur',interrupt);
  const stopHud=useHudWorldInput.subscribe(s=>{if(s.blocked&&useMmdVrStore.getState().presentation==='xr'&&interaction().reading?.room===room)interrupt();});
  const stopPress=useMilkInteraction.subscribe(s=>{if(previousHold&&previousHold!==s.hold){previousHold=null;elapsed=0;}});
  const stopBag=useBackpack.subscribe(b=>{
    if(!assetId)return;
    const live=b.live[assetId];
    if(b.busy||b.draft||b.selected!==assetId||live?.runtimeId!==runtimeId||!live.visible)interrupt();
  });
  const stopStage=useMmdVrStore.subscribe((s,p)=>{
    if(!root||!runtimeId)return;
    if(blocked()||s.overlayOpen!==p.overlayOpen||pending(runtimeId)||s.presentation!==p.presentation||s.entryEpoch!==p.entryEpoch||s.physicsEnabled!==p.physicsEnabled)interrupt();
    else if(s.materialModels[runtimeId]!==p.materialModels[runtimeId]){retireMilkReading(room);lastProbe=-Infinity;drops.advance(0);}
  });
  const stopBody=useBodyState.subscribe((s,p)=>{
    const before=profile(p),after=profile(s);
    if(before?.bareLeft!==after?.bareLeft||before?.bareRight!==after?.bareRight||before?.lactating!==after?.lactating||
      (!!s.draft&&s.draft.assetId===assetId)!==(!!p.draft&&p.draft.assetId===assetId)){
      retireMilkReading(room);lastProbe=-Infinity;drops.advance(0);
    }
  });
  const stopEvents=subscribeMilkEffects(e=>{
    if(e.kind==='clear'){if(e.assetId===assetId)drops.clear();return;}
    if(!root||e.assetId!==assetId||e.runtimeId!==runtimeId)return false;
    const b=useBackpack.getState(),live=b.live[e.assetId];
    if(blocked()||pending(e.runtimeId)||performance.now()-lastFrame>betweenFramesMaxAge*1000||b.selected!==assetId||!live?.visible||live.runtimeId!==runtimeId||
       !b.entries.some(entry=>entry.id===assetId&&entry.kind==='model')||visibleRoot(e.runtimeId)!==root||gl.getContext?.()?.isContextLost?.()||
      (useMmdVrStore.getState().presentation==='xr'&&(!session||session===ended||gl.xr.getSession()!==session||session.visibilityState!=='visible'))){interrupt();return false;}
    return drops.emit(e.side,e.amount);
  });
  const point=new Vector3(),axis=new Vector3();
  function probe(side:Side):OutletState{
    const p=useBodyState.getState().byAsset[assetId!],bare=side==='left'?p?.bareLeft:p?.bareRight;
    if(sample(side,!!bare,point,axis))return 'ready';
    const reason=samples[side][Number(!!bare)].detail.state;if(reason&&reason!=='ready')return reason;
    // A hypothetical confirmation is diagnostic only: no position from this
    // pass ever reaches the emitter; even after confirmation it samples again.
    return !bare&&sample(side,true,point,axis)?'confirm':'blocked';
  }
  function advancePanel(panel:MilkPanel,dt:number,now:number,frame?:XRFrame){
    const s=interaction(),p=useBodyState.getState(),hold=s.hold;
    if(p.draft?.assetId===panel.assetId||!p.byAsset[panel.assetId]?.lactating||
      (session&&useHudWorldInput.getState().blocked)){retireMilkReading(room);return;}
    if(hold){
      let valid=false;try{valid=!!session===!!hold.source&&hold.valid(frame);}catch{/* retired input/reference space */}
      if(!valid){releaseMilk(hold);return;}
    }
    if(!s.reading||now-lastProbe>=220||hold){
      // While pressing, watch each engaged side, including coverage between
      // beats. Between presses only sample at reading speed.
      const sample=(side:Side)=>!s.reading||now-lastProbe>=220||hold?.mode===side||hold?.mode==='both'?probe(side):s.reading[side];
      publishOutlets(panel,room,sample('left'),sample('right'));
      if(now-lastProbe>=220)lastProbe=now;
    }
    if(!hold||interaction().hold!==hold)return;
    const stock=p.byAsset[panel.assetId];
    if(hold!==previousHold){
      previousHold=hold;elapsed=0;
      for(const side of sides)flowing[side]=(hold.mode===side||hold.mode==='both')&&stock[side]>0;
      // A short, still-down press is one dose on its first verified display
      // frame. Never queue work for a press already released between frames.
    }else{
      if((elapsed+=Math.min(dt,beat))<beat)return;
      elapsed%=beat; // never issue two beats, even on a slow frame
    }
    const selected=sides.filter(side=>flowing[side]),debit=debitActorMilk(panel,selected,dose);
    if(!debit){releaseMilk(hold);return;}hold.debited=debit.left>0||debit.right>0;
    for(const side of selected){
      if(interaction().hold!==hold)return;
      if(interaction().reading?.[side]==='ready'&&debit[side]>0)drops.emit(side,debit[side],true);
      if(stock[side]<=dose)flowing[side]=false; // refilling after empty doesn't re-arm a held side
    }
    if(!flowing.left&&!flowing.right)releaseMilk(hold);
  }
  return {
    advance(dt:number,frame?:XRFrame){
      if(disposed)return;
      const b=useBackpack.getState(),id=b.selected,live=id&&b.live[id];
      // Ordinary stage roaming (including a selected, configured actor) does
      // not need an extra XR pose, root walk, or garment/skin sampling pass.
      const panel=interaction().panel,watch=panel&&panel.assetId===id&&live&&panel.runtimeId===live.runtimeId?panel:null;
      if(!drops.active&&!(watch&&profile(useBodyState.getState(),watch.assetId)?.lactating)){
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
      stamp++;evaluating=true;
      try{drops.advance(dt);if(watch)advancePanel(watch,dt,now,frame);}finally{evaluating=false;}
    },
    dispose(){
      disposed=true;stopEvents();stopStage();stopBag();stopBody();stopHud();stopPress();bindSession(null);interrupt();drops.dispose();
      gl.domElement?.removeEventListener('webglcontextlost',lost);gl.domElement?.removeEventListener('webglcontextrestored',restored);
      document.removeEventListener('visibilitychange',interrupt);window.removeEventListener('pagehide',interrupt);window.removeEventListener('blur',interrupt);
    },
  };
}
