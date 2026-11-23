import {useLayoutEffect,useRef,type RefObject} from 'react';
import {Vector3,type Group,type Object3D,type Scene} from 'three';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {TOYS,type Toy} from './propCatalog';
import type {GripFrame,PropView} from './propView';
import * as views from './propViews';
import {bindScreenWristUse,canGiveTo,useStagePlay,type CharacterToy} from './stagePlay';

type Effect = (frame:GripFrame)=>void;
type Host = {scene:Scene;canvas:HTMLCanvasElement;wrist:RefObject<Group|null>;
  getRoot:(id:string)=>Object3D|null;isRoomStale:()=>boolean};

function visibleIn(node:Object3D|null,scene:Scene){
  for(let p=node;p&&p.visible;p=p.parent)if(p===scene)return true;
  return false;
}

/** A click belongs to this committed piece and actor instance. Sample the
 * authored outlet after poseWristToy, including on paused display frames. */
export function mountScreenWristCue({scene,canvas,wrist,getRoot,isRoomStale}:Host,toy:Toy,
  outlet:NonNullable<PropView['outlet']>,effect:RefObject<Effect|null>){
  const frame:GripFrame={at:new Vector3(),dir:new Vector3(),dt:0,usable:false,action:'off'};
  let claim:{owner:CharacterToy;id:string;actor:Object3D;piece:Group;visual:Object3D}|null=null;
  let start=false,left=0,hasPlayed=false,offBeforeStart=false,lost=false,disposed=false;
  const item=TOYS[toy];
  const inBag=(asset:string)=>useBackpack.getState().entries.some(e=>e.id===asset&&e.kind==='model');
  function interrupt(){if(claim)offBeforeStart=true;claim=null;start=false;left=0;}
  function allowed(owner:CharacterToy,id:string){
    const s=useMmdVrStore.getState(),b=useBackpack.getState(),live=b.live[owner.assetId];
    return !disposed&&!lost&&!document.hidden&&!isRoomStale()&&s.presentation==='screen'&&
      !s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running&&!b.busy&&!b.draft&&b.selected===owner.assetId&&
      !s.pendingVisibilityToggles.includes(id)&&!s.pendingModelRemovals.includes(id)&&
      owner===useStagePlay.getState().character&&owner.toy===toy&&live?.runtimeId===id&&canGiveTo(live,owner.hand)&&
      (item.portable||item.home===s.prefs.scenery);
  }
  const unbind=bindScreenWristUse((owner,id)=>{
    if(!item.screenUse||!allowed(owner,id)||!inBag(owner.assetId)||!effect.current)return false;
    const actor=getRoot(id),piece=wrist.current,visual=piece?.children.find(child=>child.visible);
    if(!actor||!visibleIn(actor,scene)||!piece||!visual||!visibleIn(visual,scene))return false;
    claim={owner,id,actor,piece,visual};start=true;left=item.screenUse.duration??0;return true;
  });
  // Observe interruptions even if select-away/select-back or busy/ready is
  // batched between frames. No subscribers for unequipped or passive toys.
  const recheck=()=>{if(claim&&!allowed(claim.owner,claim.id))interrupt();};
  const offBag=useBackpack.subscribe((b,p)=>{
    if(claim&&b.entries!==p.entries&&!inBag(claim.owner.assetId))interrupt();else recheck();
  });
  const offPlay=useStagePlay.subscribe(s=>{if(claim&&s.character!==claim.owner)interrupt();});
  const offStage=useMmdVrStore.subscribe((s,p)=>{
    if(!claim)return;
    if(s.entryEpoch!==p.entryEpoch||s.prefs.scenery!==p.prefs.scenery||s.physicsEnabled!==p.physicsEnabled||s.seekEpoch!==p.seekEpoch)interrupt();
    else if(s.presentation!==p.presentation||s.overlayOpen!==p.overlayOpen||s.physicsBusy||s.physicsFatal||s.assetLoad.running||
      s.pendingVisibilityToggles!==p.pendingVisibilityToggles||s.pendingModelRemovals!==p.pendingModelRemovals)recheck();
  });
  const onLost=()=>{lost=true;interrupt();},onRestore=()=>{lost=false;};
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestore);
  document.addEventListener('visibilitychange',interrupt);window.addEventListener('blur',interrupt);
  return {advance(delta:number,posedActor:Object3D|null){
    if(disposed||(!claim&&!hasPlayed))return;
    const emit=effect.current;
    if(claim&&(!emit||!(delta>=0&&delta<.5)||!allowed(claim.owner,claim.id)||posedActor!==claim.actor||
      !visibleIn(posedActor,scene)||wrist.current!==claim.piece||claim.visual.parent!==claim.piece||!visibleIn(claim.visual,scene)))interrupt();
    if(!emit)return;
    frame.action='off';frame.usable=false;
    if(offBeforeStart&&claim){frame.dt=0;emit(frame);} // cancel the previous burst before an immediate new click
    offBeforeStart=false;
    frame.dt=Number.isFinite(delta)?Math.min(.05,Math.max(0,delta)):0;
    if(claim){
      // PropView.outlet is in rendered PlayPiece coordinates (including any
      // mesh-local rake), the same coordinate system as propCatalog.grip.
      const {piece}=claim;piece.updateWorldMatrix(true,false);
      frame.at.fromArray(outlet.position).applyMatrix4(piece.matrixWorld);
      frame.dir.fromArray(outlet.direction).transformDirection(piece.matrixWorld);
      frame.usable=true;frame.action=start?'start':left>0?'held':'off';
      hasPlayed=true;start=false;left=Math.max(0,left-frame.dt);
    }
    emit(frame);
  },dispose(){
    disposed=true;interrupt();unbind();offBag();offPlay();offStage();
    canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestore);
    document.removeEventListener('visibilitychange',interrupt);window.removeEventListener('blur',interrupt);
  }};
}

export function useScreenWristCue(toy:Toy|undefined,host:Host){
  const screen=useMmdVrStore(s=>s.presentation==='screen');
  const view=screen&&toy&&TOYS[toy].screenUse?views[TOYS[toy].view]:undefined;
  const effect=useRef<Effect|null>(null),driver=useRef<ReturnType<typeof mountScreenWristCue>|null>(null);
  const {wrist,scene,canvas,getRoot,isRoomStale}=host;
  const HeldEffect=view?.outlet&&view.HeldEffect;
  useLayoutEffect(()=>{
    if(!toy||!view?.outlet||!HeldEffect)return;
    const cue=mountScreenWristCue({scene,canvas,wrist,getRoot,isRoomStale},toy,view.outlet,effect);driver.current=cue;
    return ()=>{cue.dispose();driver.current=null;};
  },[toy,view,HeldEffect,wrist,scene,canvas,getRoot,isRoomStale]);
  // GripFrame is world-space. A trail or firework must not inherit the next wrist pose.
  return {driver,art:HeldEffect&&<group key={toy} name="play:wrist-effect" pointerEvents="none"><HeldEffect ref={effect}/></group>};
}
