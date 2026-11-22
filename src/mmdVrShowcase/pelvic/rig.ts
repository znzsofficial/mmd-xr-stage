import { Matrix4, Vector3, type Group, type Object3D, type Scene } from 'three';
import { useBackpack, type BackpackLive } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { useStagePlay } from '../play/stagePlay';
import type { GripFrame } from '../play/propView';
import type { WandModel } from '../play/wandSurface';
import { createPortDrawing, createStandDrawing, placeWorld } from './drawing';
import { createGarmentGuard } from './garment';
import { createPelvicSolver, pelvicRailMatrix, registerPelvicSocket, samplePelvicFrame,
  type PelvicCalibration, type PelvicContact, type PelvicFrame } from './geometry';
import { createPelvicInput, isMountedVisible, mountPelvicInput, samplePelvicNozzle } from './input';
import { pelvicRailTravel } from './path';
import {createStandHold} from './rigHold';
import { advancePelvic, clearPelvicSupport, consumePelvicDose, discardPelvicDoses, endPelvic, interruptPelvic,
  publishParkedSample, publishPelvicSample, publishPelvicSupport, usePelvic, type PelvicSample, type PelvicSupport } from './store';

export type PelvicRigProps={getRoot:(runtimeId:string)=>Object3D|null;getSurface?:(runtimeId:string)=>WandModel|null};
type Options=PelvicRigProps & {scene:Scene;host:Group;standPiece:()=>Group|null;standSpray:() => ((f:GripFrame)=>void)|null;tracked?:(frame:XRFrame)=>boolean};
type Binding=ReturnType<typeof bind>;
type Aperture={assetId:string;runtimeId:string;amount:number};
export type PelvicRigHandle={advance:(delta:number,frame?:XRFrame,blocked?:boolean)=>void;interrupt:()=>void;
  getStandRoot:()=>Group|null;getStandBinding:()=>object|null;getAperture:()=>Aperture|null;getObserverAnchor:(out:Vector3)=>boolean};

function manualSeed(root:Object3D,live:BackpackLive):PelvicSupport['manualSeed']{
  if(!live.bounds)return;
  const h=live.bounds.size[1];root.updateWorldMatrix(true,false);
  const scale=root.matrixWorld.getMaxScaleOnAxis();if(!(h>0&&scale>0&&Number.isFinite(h/scale)))return;
  const center=root.worldToLocal(new Vector3(...live.bounds.center));
  // Only a ruler and convenient initial marker for the MANUAL command. A
  // mesh envelope never produces an enabled socket or anatomical evidence.
  center.y-=.025*h/scale;
  return {origin:center.toArray(),unitsPerMeter:h/(1.65*scale)};
}
function bind(o:Options,id:string,live:BackpackLive,root:Object3D,c:PelvicCalibration){
  const socket=registerPelvicSocket(root,c),runtimeId=live.runtimeId;
  const support:PelvicSupport={runtimeId,kind:socket?.kind??'missing',anchorName:socket?.anchor.name??'',manualSeed:manualSeed(root,live)};
  return {root,runtimeId,c,socket,support,frame:null as PelvicFrame|null,guard:null as ReturnType<typeof createGarmentGuard>|null,port:createPortDrawing(o.host,id)};
}
function observations(){
  const axis=new Vector3(),tailToTip=new Vector3(),inward=new Vector3(0,0,-1);
  const tip:[number,number,number]=[0,0,0],tail:[number,number,number]=[0,0,0],shaft:[number,number,number][]=[];
  const data:PelvicSample={tip,tail,shaft,depth:0,angleDeg:0,aligned:false,atCervix:false,outletInside:false,outletVisible:false,radiusM:0,lengthM:0};
  return (f:PelvicFrame,c:PelvicContact,dir:Vector3)=>{
    c.outletLocal.toArray(tip);c.shaftLocal[0].toArray(tail);
    for(let i=0;i<c.shaftLocal.length;i++)c.shaftLocal[i].toArray(shaft[i]??=[0,0,0]);shaft.length=c.shaftLocal.length;
    data.depth=c.depthM;data.outletInside=c.outletInside;data.outletVisible=c.outletVisible;data.atCervix=c.atCervix;
    data.radiusM=f.radiusM;data.lengthM=f.lengthM;
    axis.copy(dir).transformDirection(f.inverse);data.angleDeg=axis.angleTo(inward)*180/Math.PI;
    // Outside: does the physical nozzle point at the actual aperture? A rod
    // parallel to the canal but off to one side must not read as aligned.
    tailToTip.copy(c.outletLocal);if(axis.z<0&&tailToTip.z>=0)tailToTip.addScaledVector(axis,-tailToTip.z/axis.z);
    data.aligned=c.inside||(c.outletLocal.z>=0&&axis.z<=-.78&&Math.hypot(tailToTip.x,tailToTip.y)<=f.radiusM*.85);
    return data;
  };
}

/** StageRoom calls advance only after the final displayed VMD/Bullet pose.
 * No second useFrame, no mutation of an animated bone, player arm or grip. */
export function mountPelvicRig(o:Options):PelvicRigHandle&{dispose:()=>void}{
  const bindings=new Map<string,Binding>(),solver=createPelvicSolver(),sample=observations(),railWorld=new Matrix4(),observer=new Vector3();
  const spray:GripFrame={at:new Vector3(),dir:new Vector3(),action:'off',usable:false,dt:0},hold=createStandHold();
  let token=-1,owner:object|null=null,actor:Object3D|null=null,source:XRInputSource|null=null,epoch=0,aperture:Aperture|null=null,
    standKey:object|null=null,stand:ReturnType<typeof createStandDrawing>|null=null,session:XRSession|null=null,disposed=false,hasObserver=false;
  const input=createPelvicInput(o.scene,()=>{
    const a=usePelvic.getState().active,h=useStagePlay.getState().held;
    return a?.mode==='xrManual'&&h?.toy==='dildo'?{token:a.token,hand:h.hand}:null;
  }),unmountInput=mountPelvicInput(o.scene,input);

  function hideStand(){if(stand)stand.body.visible=false;const piece=o.standPiece();if(piece)piece.visible=false;standKey=null;hold.clear();}
  function reset(clearInput=true){solver.reset();source=null;epoch=0;aperture=null;hasObserver=false;hideStand();if(clearInput)input.clear();}
  function currentRoomToken(){
    const state=usePelvic.getState(),a=state.active,play=useStagePlay.getState();if(!a)return null;
    const b=bindings.get(a.assetId);
    // A start can happen after the last advance. Runtime IDs alone can repeat
    // in the next room; only this room's published support identifies its root.
    return b&&b.runtimeId===a.runtimeId&&state.support[a.assetId]===b.support&&o.getRoot(a.runtimeId)===b.root&&
      useBackpack.getState().live[a.assetId]?.runtimeId===a.runtimeId&&
      (a.mode==='xrManual'?play.held?.toy==='dildo':play.stand?.assetId===a.assetId)?a.token:null;
  }
  function cancel(t:number){reset();for(const b of bindings.values())if(b.root===actor)b.port.group.visible=false;if(t!==-1)interruptPelvic(t);}
  function interrupt(){cancel(currentRoomToken()??token);}
  const change=()=>interrupt();
  function listen(next:XRSession|null){if(next===session)return;
    for(const name of ['end','inputsourceschange','visibilitychange'] as const){session?.removeEventListener(name,change);next?.addEventListener(name,change);}session=next;}
  const hidden=()=>{if(document.hidden)interrupt();};if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  function remove(id:string,b:Binding){clearPelvicSupport(id,b.support);b.port.dispose();bindings.delete(id);}
  function validStand(){const a=usePelvic.getState().active,b=a&&bindings.get(a.assetId),p=o.standPiece();
    return !!(standKey&&a?.running&&a.mode!=='xrManual'&&a.token===token&&useStagePlay.getState().stand===owner&&b&&p&&
      o.getRoot(a.runtimeId)===actor&&b.root===actor&&useBackpack.getState().live[a.assetId]?.visible&&b.root.visible&&
      !b.support.obstruction&&b.c===usePelvic.getState().byAsset[a.assetId]?.calibration&&isMountedVisible(p,o.scene)&&hold.shown(p));}

  function advance(delta:number,frame?:XRFrame,blocked=false){
    if(disposed)return;
    const state=usePelvic.getState(),bag=useBackpack.getState(),stage=useMmdVrStore.getState(),a=state.active;
    const lastAperture=aperture;
    aperture=null;hasObserver=false;spray.dt=Number.isFinite(delta)?Math.max(0,Math.min(.05,delta)):0;spray.usable=false;spray.action='off';
    const queued=a?.mode==='xrManual'?input.take(frame,a.token):null;
    let heldReady=false,standReady=false;
    try{
      const sessionChanged=session!==null&&frame&&frame.session!==session;
      if(stage.presentation==='xr'&&frame)listen(frame.session);else if(stage.presentation!=='xr')listen(null);
      const unsafe=blocked||!stage.overlayOpen||stage.physicsBusy||stage.physicsFatal||stage.assetLoad.running||bag.busy||!!bag.draft||
        stage.presentation==='xr'&&(!frame||frame.session.visibilityState!=='visible'||useHudWorldInput.getState().blocked);
      for(const [id,b] of bindings)if(!state.byAsset[id]||!bag.live[id]?.visible||bag.live[id].runtimeId!==b.runtimeId||
        o.getRoot(b.runtimeId)!==b.root){if(b.root===actor)cancel(token);remove(id,b);}
      if(unsafe){for(const b of bindings.values())b.port.group.visible=false;interrupt();return;}
      for(const [id,live] of Object.entries(bag.live)){
        const profile=state.byAsset[id],root=profile&&live.visible&&o.getRoot(live.runtimeId);if(!root)continue;
        let b=bindings.get(id);if(!b){b=bind(o,id,live,root,profile.calibration);bindings.set(id,b);}
        if(profile.calibration!==b.c){
          const c=profile.calibration,prev=b.c.manual,next=c.manual;
          if(prev!==next&&(!prev||!next||prev.unitsPerMeter!==next.unitsPerMeter||prev.origin.some((n,i)=>n!==next.origin[i]))){
            b.socket=registerPelvicSocket(root,c);b.support={...b.support,kind:b.socket?.kind??'missing',anchorName:b.socket?.anchor.name??'',obstruction:undefined};
          }
          // Fit parameters do not change the character's rendered topology.
          // Invalidate temporal evidence, but keep garment buffers and art.
          b.c=c;if(id===a?.assetId){standKey=null;solver.reset();aperture=null;}
        }
        if(a?.assetId!==id&&bag.selected!==id&&!(profile.showAdapter&&profile.clothingClear)){
          b.port.group.visible=false;if(usePelvic.getState().support[id]!==b.support)publishPelvicSupport(id,b.support);continue;
        }
        b.frame=samplePelvicFrame(b.socket,b.c,b.frame??undefined);
        const obstruction=b.frame?(b.guard??=createGarmentGuard(root,o.getSurface?.(live.runtimeId)))(b.frame):undefined,kind=b.frame?b.socket!.kind:'missing';
        const garmentNames=b.guard?.garmentNames,blockerName=obstruction==='garment'?b.guard?.blockerName():undefined;
        if(b.support.obstruction!==obstruction||b.support.kind!==kind||b.support.garmentNames!==garmentNames||b.support.blockerName!==blockerName)
          b.support={...b.support,kind,obstruction,garmentNames,blockerName};
        if(usePelvic.getState().support[id]!==b.support)publishPelvicSupport(id,b.support);
        if(!b.frame)b.port.group.visible=false;
        else if(!a?.running||a.assetId!==id||obstruction||!profile.clothingClear)b.port.draw(b.frame,profile.showAdapter&&profile.clothingClear&&!obstruction,bag.selected===id);
      }
      if(!a){if(owner)reset();token=-1;owner=actor=null;return;}
      const b=bindings.get(a.assetId),profile=state.byAsset[a.assetId],play=useStagePlay.getState(),manual=a.mode==='xrManual',currentOwner=manual?play.held:play.stand,f=b?.frame;
      const rebound=token!==a.token||actor!==b?.root||owner!==currentOwner;
      if(rebound){reset(false);token=a.token;owner=currentOwner;actor=b?.root??null;}
      if(!b||!f||!profile||!currentOwner||currentOwner.toy!=='dildo'||!manual&&play.stand?.assetId!==a.assetId||b.runtimeId!==a.runtimeId||
        usePelvic.getState().active?.token!==a.token){cancel(a.token);return;}
      // A blocked or unconfirmed port prevents work, not fitting an unpowered
      // stand outside the actor. Only the running branch may feed the solver
      // a crossing, expose a Bullet collider, open the seal or route a dose.
      if((manual||a.running)&&(b.support.obstruction||!profile.clothingClear)){interrupt();return;}
      if(a.awaitingWorld){hideStand();return;}
      const piece=manual?queued?.root:o.standPiece();
      // React can commit the single stand mesh one render after an ownership
      // change. Never start/advance the motor until its actual piece is live.
      if(!piece||!manual&&(!piece.parent||!isMountedVisible(piece.parent,o.scene)||!hold.shown(piece))){
        if(!a.running||manual||standKey)interrupt();else discardPelvicDoses(a.token);return;
      }
      if(manual){hideStand();if(!a.running||!queued)return;
        if(source&&(source!==queued.source||epoch!==queued.epoch)){interrupt();return;}source=queued.source;epoch=queued.epoch;
      }
      if(!manual&&a.running){
        const tracked=a.source!=='xr'||!!(frame&&o.tracked?.(frame));
        if(sessionChanged||a.source==='xr'&&o.tracked&&!tracked){interrupt();return;}
        if(delta>=.12&&Number.isFinite(delta)){
          // A render stall cannot drive the motor. Only the actual unchanged
          // mounted coordinates preserve prior evidence; a slider command (or
          // a fresh token inside) never admits a new contact on a long frame.
          if(!tracked||rebound||!validStand()||currentRoomToken()!==token||bag.selected&&bag.selected!==a.assetId||
             typeof document!=='undefined'&&document.hidden||!hold.matches(f,piece)){interrupt();return;}
          discardPelvicDoses(token);aperture=lastAperture;observer.setFromMatrixPosition(f.world);hasObserver=true;return;
        }
      }
      const travel=a.running?advancePelvic(a.token,delta):a.position;
      if(usePelvic.getState().active?.token!==a.token){interrupt();return;}
      if(!manual){
        pelvicRailMatrix(f,pelvicRailTravel(f,travel),railWorld);placeWorld(piece,railWorld);piece.visible=true;
        if(!stand)stand=createStandDrawing(o.host);stand.draw(f,railWorld,bag.live[a.assetId].position[1]);
        if(a.running)standKey??={};
      }
      samplePelvicNozzle(piece,spray);
      const contact=solver.step(f,piece.matrixWorld,{dt:delta,blocked:!a.running});
      if(!contact.shaftLocal.length){interrupt();return;}
      if(!a.running){publishParkedSample(a.token,sample(f,contact,spray.dir));return;}
      const amount=b.port.draw(f,profile.showAdapter,bag.selected===a.assetId,contact);
      if(amount>0)aperture={assetId:a.assetId,runtimeId:a.runtimeId,amount};
      if(!publishPelvicSample(a.token,sample(f,contact,spray.dir))){interrupt();return;}
      if(!manual)hold.record(f,piece);
      observer.setFromMatrixPosition(f.world);hasObserver=true;
      const route=consumePelvicDose(a.token,contact,queued?.f.action==='start');
      // A stopped/restarted motor can reuse its emitter without a stopped frame.
      // Only a fresh external dose may start a pulse on the new binding.
      spray.usable=contact.outletVisible&&!contact.outletInside&&(!rebound||route==='external');
      spray.action=route==='external'&&spray.usable?'start':'off';
      heldReady=manual;standReady=!manual;
    }finally{
      // Always tick the SAME emitter, once. Cancel a partly emitted train when
      // the next frame moves inside, ownership changes or tracking is lost.
      if(queued){if(!heldReady){spray.usable=false;spray.action='off';}queued.spray?.(spray);}
      if(!standReady){spray.usable=false;spray.action='off';}o.standSpray()?.(spray);
    }
  }
  return {advance,interrupt,getStandRoot:()=>validStand()?o.standPiece():null,getStandBinding:()=>validStand()?standKey:null,
    getAperture:()=>usePelvic.getState().active?.token===token?aperture:null,
    getObserverAnchor(out){if(!hasObserver||!actor?.visible||currentRoomToken()!==token)return false;out.copy(observer);return true;},
    dispose(){if(disposed)return;const last=currentRoomToken()??token;disposed=true;listen(null);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
      unmountInput();reset();stand?.dispose();if(last!==-1)endPelvic(last);for(const [id,b] of bindings)remove(id,b);}};
}
