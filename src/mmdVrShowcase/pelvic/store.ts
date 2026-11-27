import { create } from 'zustand';
import { useBackpack } from '../backpack/store';
import { isSoloFloorSession } from '../backpack/sessionAssets';
import { sessionToys } from '../play/propCatalog';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { useStagePlay, type Hand } from '../play/stagePlay';
import { defaultPelvicCalibration, type ContactMotion, type PelvicCalibration, type PelvicContact, type PelvicXYZ } from './contract';
import { canStartAtOpening, PELVIC_LIMITS as limits, type PelvicActive, type PelvicContainer, type PelvicDoseTarget, type PelvicMode, type PelvicPatch, type PelvicProfile, type PelvicSample, type PelvicSupport } from './stateTypes';
import {createRailRecorder,createRailReplay} from './railTechnique';
import {recordInternalDose} from '../bodyState/reproduction/store';

export * from './stateTypes';

type StrokeOrder={id:number;token:number;target:PelvicContainer;phase:'waiting'|'dispatched';deadline:number;driveDeadline:number;lastEnd:number};
type Receipt='delivered'|'cancelled'|'missed'|'expired';
type State = { byAsset:Record<string,PelvicProfile>; active:PelvicActive|null; sample:PelvicSample|null; parkedSample:PelvicSample|null; support:Record<string,PelvicSupport>;
  strokeOrder:StrokeOrder|null;strokeReceipt:Receipt|null };
export const usePelvic = create<State>(()=>({byAsset:{},active:null,sample:null,parkedSample:null,support:{},strokeOrder:null,strokeReceipt:null}));
const state=usePelvic.getState;
const outside=limits.position[0];
let sequence=0;
// Only this clock owns the continuous rail position. React gets a decimated
// copy with measured geometry, never a notification per controller frame.
let position:number=outside, direction=1, doseCount=0, publishIn=0, seed=true, dispensed=false;
let doseTarget:PelvicDoseTarget='vaginal';
let lastInside=false,entering=false,driveSeconds=0,forwardEnds=0;
function settleOrder(receipt:Receipt){if(state().strokeOrder)usePelvic.setState({strokeOrder:null,strokeReceipt:receipt});}
let recorder:ReturnType<typeof createRailRecorder>|null=null,replay:ReturnType<typeof createRailReplay>|null=null;
const clamp=(x:number,[lo,hi]:readonly [number,number])=>Math.min(hi,Math.max(lo,x));
function limited(n:number|undefined, fallback:number, range:readonly [number,number]) {
  return n!==undefined&&Number.isFinite(n)?clamp(n,range):fallback;
}
const finiteXYZ=(p:PelvicXYZ|undefined):p is PelvicXYZ=>!!p&&p.length===3&&p.every(Number.isFinite);
const copyXYZ=(p:PelvicXYZ):PelvicXYZ=>[p[0],p[1],p[2]];
function calibrate(c:PelvicCalibration,p:Partial<PelvicCalibration>):PelvicCalibration {
  const v=p.offsetM;
  return {
    offsetM:finiteXYZ(v)?[clamp(v[0],limits.offsetM),clamp(v[1],limits.offsetM),clamp(v[2],limits.offsetM)]:c.offsetM,
    pitchDeg:limited(p.pitchDeg,c.pitchDeg,limits.pitchDeg),yawDeg:limited(p.yawDeg,c.yawDeg,limits.yawDeg),
    radiusM:limited(p.radiusM,c.radiusM,limits.radiusM),lengthM:limited(p.lengthM,c.lengthM,limits.lengthM),
    manual:p.manual===null?null:p.manual&&finiteXYZ(p.manual.origin)&&Number.isFinite(p.manual.unitsPerMeter)&&p.manual.unitsPerMeter>0
      ?{origin:copyXYZ(p.manual.origin),unitsPerMeter:clamp(p.manual.unitsPerMeter,limits.unitsPerMeter)}:c.manual,
  };
}
function newProfile():PelvicProfile {
  return {calibration:calibrate(defaultPelvicCalibration,defaultPelvicCalibration),clothingClear:false,showAdapter:false,container:'vaginal',
    fluid:{vaginal:0,fantasyUterine:0},capacity:{vaginal:4,fantasyUterine:16},overflow:0,drained:0,speedHz:.5,stroke:.7};
}
function ready(assetId:string){
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
  return stage.overlayOpen&&!stage.physicsBusy&&!stage.physicsFatal&&!stage.assetLoad.running&&!bag.draft&&!bag.busy&&bag.live[assetId]?.visible;
}
function selected(assetId:string){return useBackpack.getState().selected===assetId&&ready(assetId);}
function writeProfile(assetId:string,p:PelvicProfile){usePelvic.setState(s=>({byAsset:{...s.byAsset,[assetId]:p}}));}
function omit<T>(map:Record<string,T>,id:string){const next={...map};delete next[id];return next;}
export function setActorResponse(assetId:string,runtimeId:string,choice:string|null|undefined){
  const {byAsset,support}=state(),p=byAsset[assetId];
  if(!selected(assetId)||useBackpack.getState().live[assetId]?.runtimeId!==runtimeId||!p||support[assetId]?.runtimeId!==runtimeId)return false;
  if(typeof choice==='string'&&!support[assetId].responseMorphs?.includes(choice))return false;
  if(p.responseMorph!==choice)writeProfile(assetId,{...p,responseMorph:choice});
  return true;
}
export function enablePelvic(assetId:string,confirmedAdult=false){
  if(!selected(assetId)||!useBackpack.getState().entries.some(e=>e.kind==='model'&&e.id===assetId))return false;
  if(state().byAsset[assetId])return true;
  if(confirmedAdult!==true)return false;
  writeProfile(assetId,newProfile());return true;
}
export function disablePelvic(assetId:string){
  if(!selected(assetId)||!state().byAsset[assetId])return false;
  releasePelvic(assetId);usePelvic.setState(s=>({byAsset:omit(s.byAsset,assetId)}));return true;
}
/** Mount on the actor's underlying skin, even while a separate garment covers
 * it. Do not change the clothing choice, operating token or delivery route. */
export function setPelvicAdapter(assetId:string,runtimeId:string,on:boolean){
  const {byAsset,support}=state(),p=byAsset[assetId],s=support[assetId];
  if(!selected(assetId)||!p||useBackpack.getState().live[assetId]?.runtimeId!==runtimeId||
    (on&&(!s||s.runtimeId!==runtimeId||s.kind==='missing')))return false;
  writeProfile(assetId,{...p,showAdapter:on});return true;
}
export function patchPelvic(assetId:string,patch:PelvicPatch){
  const p=state().byAsset[assetId];if(!selected(assetId)||!p)return false;
  const clothed=patch.clothingClear||patch.calibration?false:patch.clothed??!!p.clothed;
  const clothingClear=patch.calibration||clothed?false:patch.clothingClear??p.clothingClear;
  const geometryChanged=!!patch.calibration||p.clothingClear!==clothingClear||!!p.clothed!==clothed;
  const active=state().active;
  if(geometryChanged&&active?.assetId===assetId)park(active);
  const targetChanged=!!patch.container&&patch.container!==p.container&&active?.assetId===assetId;
  if(targetChanged)doseCount=0;
  const next:PelvicProfile={...p,calibration:patch.calibration?calibrate(p.calibration,patch.calibration):p.calibration,
    clothingClear,clothed,rimMode:patch.rimMode??p.rimMode,
    container:patch.container==='vaginal'||patch.container==='fantasyUterine'?patch.container:p.container,
    speedHz:limited(patch.speedHz,p.speedHz,limits.speedHz),stroke:limited(patch.stroke,p.stroke,limits.stroke),
    replayRate:limited(patch.replayRate,p.replayRate??1,limits.replayRate),replayLoop:patch.replayLoop??p.replayLoop};
  usePelvic.setState(s=>({byAsset:{...s.byAsset,[assetId]:next},...(targetChanged?{strokeOrder:null,strokeReceipt:s.strokeOrder?'cancelled' as const:null}:{})}));
  return true;
}
export function publishPelvicSupport(assetId:string,support:PelvicSupport){
  const bag=useBackpack.getState(),live=bag.live[assetId];
  if(!live?.visible||live.runtimeId!==support.runtimeId||state().support[assetId]===support)return;
  const a=state().active;
  if(a?.assetId===assetId&&(support.kind==='missing'||a.take&&!canStartAtOpening(state().byAsset[assetId],support)))interruptPelvic(a.token);
  else if(a?.assetId===assetId&&a.mode==='standAuto'&&!canStartAtOpening(state().byAsset[assetId],support))discardPelvicDoses(a.token);
  usePelvic.setState(s=>({support:{...s.support,[assetId]:support}}));
}
/** Called only on the positive-depth frame of an opted-in solver crossing. */
export function rememberRimEntry(token:number,side:NonNullable<PelvicProfile['rimMemory']>){
  const {active:a,byAsset,support}=state();if(!a?.running||a.token!==token||blocked(a))return;
  const p=byAsset[a.assetId],s=support[a.assetId];
  if(p?.rimMode==='remember'&&!p.rimMemory&&s?.runtimeId===a.runtimeId&&canStartAtOpening(p,s))writeProfile(a.assetId,{...p,rimMemory:side});
}
/** Apply the ordinary actor material setting (including outlines/proxies).
 * It is reversible even with the motor off. Only a later scan of the actual
 * drawable can confirm clearance after changing the visible clothing. */
export function setPelvicGarmentVisible(assetId:string,materialName:string,visible:boolean){
  const live=useBackpack.getState().live[assetId],s=state().support[assetId],stage=useMmdVrStore.getState();
  if(!selected(assetId)||!state().byAsset[assetId]||s?.runtimeId!==live?.runtimeId||!s?.garmentNames?.includes(materialName)||!stage.runtimeRef||
     !stage.materialModels[live.runtimeId]?.some(m=>m.name===materialName&&m.visible!==visible))return false;
  patchPelvic(assetId,{clothingClear:false});
  stage.setMaterialVisible(live.runtimeId,materialName,visible);return true;
}
export function clearPelvicSupport(assetId:string,support:PelvicSupport){
  if(state().support[assetId]!==support)return;
  const a=state().active;if(a?.assetId===assetId)interruptPelvic(a.token);
  usePelvic.setState(s=>({support:omit(s.support,assetId)}));
}

function blocked(a:Pick<PelvicActive,'assetId'|'source'>){
  const bag=useBackpack.getState();
  return !ready(a.assetId)||!!bag.selected&&bag.selected!==a.assetId||a.source==='xr'&&useHudWorldInput.getState().blocked;
}
function resetDrive(){recorder=null;replay=null;doseCount=0;publishIn=0;seed=true;dispensed=false;lastInside=entering=false;driveSeconds=forwardEnds=0;}
function park(a:PelvicActive){
  position=outside;direction=1;resetDrive();
  usePelvic.setState({active:{...a,token:++sequence,running:false,awaitingWorld:false,position,take:undefined},sample:null,parkedSample:null,strokeOrder:null,
    strokeReceipt:state().strokeOrder?.token===a.token?'cancelled':null});
}
function dropBinding(){
  position=outside;direction=1;resetDrive();
  usePelvic.setState({active:null,sample:null,parkedSample:null,strokeOrder:null,strokeReceipt:null});
}
/** Explicit command only; neither wearing, selecting, nor calibrating takes a toy. */
export function assignPelvic(assetId:string,mode:PelvicMode,source:PelvicActive['source'],hand:Hand='right'){
  const {byAsset,support}=state(),live=useBackpack.getState().live[assetId],stage=useMmdVrStore.getState();
  if(!selected(assetId)||!byAsset[assetId]||source!==stage.presentation||blocked({assetId,source})||
    (mode==='xrManual'&&(source!=='xr'||!sessionToys().includes('dildo')))||support[assetId]?.runtimeId!==live.runtimeId||support[assetId].kind==='missing')return false;
  const play=useStagePlay.getState();
  if(mode==='xrManual'){
    if(play.held?.toy!=='dildo'||play.held.hand!==hand)play.equip('dildo',hand);
    const held=useStagePlay.getState().held;if(held?.toy!=='dildo'||held.hand!==hand)return false;
  }else if(play.stand?.assetId!==assetId)play.mountStand(assetId);
  park({assetId,runtimeId:live.runtimeId,mode,source,token:0,running:false,awaitingWorld:false,position:outside});return true;
}
export function startPelvic(assetId:string){
  const a=state().active,s=state().support[assetId];
  if(a?.assetId!==assetId||blocked(a)||!s||s.runtimeId!==a.runtimeId||s.kind==='missing')return false;
  if(a.running||a.awaitingWorld)return true;
  const p=state().byAsset[assetId];if(!p||!canStartAtOpening(p,s))return false;
  const awaitingWorld=a.mode==='xrManual'&&!!useBackpack.getState().selected;
  doseCount=0;publishIn=0;
  usePelvic.setState({active:{...a,token:++sequence,awaitingWorld,running:!awaitingWorld},sample:null,parkedSample:null,strokeOrder:null,strokeReceipt:null});return true;
}
export function interruptPelvic(token:number){
  const a=state().active;
  if(a?.token!==token)return false;
  if(a.running||a.awaitingWorld||state().sample||position!==outside)park(a);
  else if(state().parkedSample)usePelvic.setState({parkedSample:null});
  return true;
}
/** User emergency stop freezes the actual rail, even mid-travel. Discard any
 * outstanding manual target and dose. A tracking/geometry interruption parks
 * instead; after either, the solver must observe a fresh entrance crossing. */
export function stopPelvic(assetId:string){
  const a=state().active;if(a?.assetId!==assetId)return false;
  if(!a.running&&!a.awaitingWorld)return true;
  freeze(a);return true;
}
function freeze(a:PelvicActive,profile?:PelvicProfile){
  resetDrive();usePelvic.setState(s=>({active:{...a,position,token:++sequence,running:false,awaitingWorld:false,take:undefined},sample:null,parkedSample:null,strokeOrder:null,strokeReceipt:s.strokeOrder?'cancelled':null,
    byAsset:profile?{...s.byAsset,[a.assetId]:profile}:s.byAsset}));
}
export function endPelvic(token:number){
  const a=state().active;if(a?.token!==token)return false;
  const play=useStagePlay.getState(),owner=a.mode==='xrManual'?play.held:play.stand;
  dropBinding();
  const current=useStagePlay.getState();
  if(owner&&!state().active&&owner===(a.mode==='xrManual'?current.held:current.stand))current.stow();
  return true;
}
export function releasePelvic(assetId:string){const a=state().active;return a?.assetId===assetId&&endPelvic(a.token);}

export function nudgePelvic(assetId:string,deltaNormalized:number){
  const a=state().active;if(a?.assetId!==assetId||!a.running||blocked(a)||a.mode!=='standManual'||a.take?.kind==='replay'||!Number.isFinite(deltaNormalized))return false;
  usePelvic.setState({active:{...a,position:clamp(a.position+deltaNormalized,limits.position)}});return true;
}
/** Call once on the render clock, including when VMD is paused. Not wall time.
 * A gap invalidates the old token; a real stroke never catches up after a stall. */
export function advancePelvic(token:number,dtSeconds:number){
  const a=state().active;if(a?.token!==token)return outside;
  if(!a.running)return position;
  if(blocked(a)||!Number.isFinite(dtSeconds)||dtSeconds<0||dtSeconds>.25){interruptPelvic(token);return outside;}
  publishIn-=dtSeconds;dispensed=false;
  // Seed the current pose (outside on a fresh assignment) before crossing,
  // even if start and dragging the slider to its far stop share one frame.
  if(seed){seed=false;return position;}
  const dt=Math.min(.05,dtSeconds);
  if(replay){
    const p=state().byAsset[a.assetId];position=replay.next(dtSeconds,p.replayRate??1,!!p.replayLoop);
  }else if(a.mode==='standManual'){
    const delta=a.position-position;
    position=Math.abs(delta)<=dt*2?a.position:position+Math.sign(delta)*dt*2;
  }else if(a.mode==='standAuto'){
    const {speedHz,stroke}=state().byAsset[a.assetId];
    driveSeconds+=dtSeconds;
    // Reflect a continuous position at the two ends. A live stroke reduction
    // retracts at the motor speed rather than snapping to the new end point.
    const distance=dt*2*speedHz*(stroke-outside);
    if(position>stroke){if(direction===1)forwardEnds++;direction=-1;position=Math.max(stroke,position-distance);}
    else{
      position+=direction*distance;
      if(position>=stroke){position=stroke-(position-stroke);direction=-1;forwardEnds++;}
      else if(position<=outside){position=outside+(outside-position);direction=1;}
    }
  }
  return position;
}

/** Never announce a take based on the target slider. Even when the motor is
 * already running, both the live rail clock AND mounted outlet must be home. */
export function startRailTechnique(assetId:string,kind:'record'|'replay'){
  const {active:a,byAsset,support,sample,parkedSample}=state(),p=byAsset[assetId];
  if(!a||a.assetId!==assetId||a.mode!=='standManual'||a.take||!selected(assetId)||blocked(a)||!p||
    support[assetId]?.runtimeId!==a.runtimeId||!canStartAtOpening(p,support[assetId])||Math.abs(position-outside)>1e-6||!(a.running?sample:parkedSample)?.railHome||
    (kind==='replay'&&!p.technique))return false;
  // A jog from .55 to -.2 can round to -.19999999999999996. Only snap
  // this sub-micron residue after the mounted outlet also measured home.
  position=outside;resetDrive();if(kind==='record')recorder=createRailRecorder();else replay=createRailReplay(p.technique!);
  usePelvic.setState({active:{...a,position,running:true,token:++sequence,take:kind==='record'?{kind,seconds:0,canSave:false}:{kind}},sample:null,parkedSample:null});return true;
}
export function saveRailTechnique(assetId:string){
  const a=state().active;if(a?.assetId!==assetId||a.take?.kind!=='record'||!selected(assetId)||blocked(a))return false;
  const clip=recorder?.finish();if(!clip)return false;
  freeze(a,{...state().byAsset[assetId],technique:clip});return true;
}
export function clearRailTechnique(assetId:string){
  const {active:a,byAsset}=state(),p=byAsset[assetId];
  if(!selected(assetId)||!p?.technique||a?.assetId===assetId&&a.take)return false;
  writeProfile(assetId,{...p,technique:undefined});return true;
}
/** Called by the room *after* placement and admission, even when the HUD sample
 * did not change. A held slow frame can extend an observed dwell only. */
export function presentRailTechnique(token:number,dt:number,measured:number|null,atHome=false){
  const a=state().active;if(a?.token!==token||!a.take)return;
  if(a.take.kind==='record'&&recorder){
    if(!(measured===null?recorder.hold(dt):recorder.sample(dt,measured))){interruptPelvic(token);return;}
    const seconds=Math.floor(recorder.seconds()),canSave=recorder.savable();
    if(seconds!==a.take.seconds||canSave!==a.take.canSave)usePelvic.setState({active:{...a,take:{kind:'record',seconds,canSave}}});
  }else if(replay&&measured!==null&&replay.presented(atHome,!!state().byAsset[a.assetId].replayLoop))freeze(a);
}
const snapshot=(sample:PelvicSample)=>({...sample,tip:copyXYZ(sample.tip),tail:copyXYZ(sample.tail),shaft:sample.shaft?.map(copyXYZ)});
/** Idle geometry is read from the mounted mesh. It deliberately has no
 * crossing history and cannot authorize motor, aperture, physics or dosing. */
export function publishParkedSample(token:number,sample:PelvicSample){
  const a=state().active;if(a?.token!==token||a.running||a.awaitingWorld||a.mode==='xrManual')return;
  const prev=state().parkedSample;
  // The rail is rigid relative to the socket. A dancing actor should not
  // rerender every diagram merely due to floating point roundoff in that fit.
  if(prev&&prev.railHome===sample.railHome&&Math.abs(prev.radiusM-sample.radiusM)<1e-6&&Math.abs(prev.lengthM-sample.lengthM)<1e-6&&
    sample.tip.every((n,i)=>Math.abs(prev.tip[i]-n)<1e-6)&&sample.tail.every((n,i)=>Math.abs(prev.tail[i]-n)<1e-6))return;
  usePelvic.setState({parkedSample:{...snapshot(sample),atCervix:false,depth:0,outletInside:false,outletVisible:false}});
}
export function publishPelvicSample(token:number,sample:PelvicSample){
  const a=state().active;if(a?.token!==token||!a.running||blocked(a))return false;
  if(![sample.depth,sample.angleDeg,sample.radiusM,sample.lengthM].every(Number.isFinite)||!finiteXYZ(sample.tip)||!finiteXYZ(sample.tail)||
      sample.shaft&&!sample.shaft.every(finiteXYZ)){interruptPelvic(token);return false;}
  const prev=state().sample;
  if(prev&&publishIn>0&&prev.railHome===sample.railHome&&prev.outletInside===sample.outletInside&&prev.outletVisible===sample.outletVisible&&prev.exteriorCovered===sample.exteriorCovered&&prev.atCervix===sample.atCervix&&prev.aligned===sample.aligned)return true;
  publishIn=.1;
  usePelvic.setState({active:a.mode==='standAuto'&&a.position!==position?{...a,position}:a,sample:snapshot(sample)});return true;
}

export function requestPelvicDose(assetId:string,target:PelvicDoseTarget,token=state().active?.token){
  const {active:a,sample,byAsset}=state();
  if(a?.assetId!==assetId||a.token!==token||!a.running||a.mode==='xrManual'||!selected(assetId)||blocked(a)||!sample)return false;
  if(a.mode==='standAuto'&&(state().strokeOrder||doseCount))return false;
  if(target==='external'?sample.outletInside||!sample.outletVisible:!sample.outletInside)return false;
  // An explicit change before the delivery frame retires the old target's
  // pending doses; those units must never be delivered to the new site.
  if(doseTarget!==target)doseCount=0;
  doseTarget=target;doseCount++;
  const p=byAsset[assetId];if(target!=='external'&&p.container!==target)writeProfile(assetId,{...p,container:target});
  return true;
}
/** One motor gesture owns at most the current/next inward pass. The HUD does
 * not dispatch a dose. Only the previous post-pose outlet can already have
 * qualified it; that named dose then gets exactly ONE delivery frame. */
export function requestStrokeDose(assetId:string,token:number,target:PelvicContainer){
  const {active:a,byAsset,support,strokeOrder}=state(),p=byAsset[assetId];
  if(!a||a.token!==token||a.assetId!==assetId||a.mode!=='standAuto'||!a.running||blocked(a)||!selected(assetId)||
    !p||!canStartAtOpening(p,support[assetId])||strokeOrder||doseCount)return false;
  const ttl=1/p.speedHz+.12;
  usePelvic.setState({strokeOrder:{id:++sequence,token,target,phase:lastInside?'dispatched':'waiting',deadline:performance.now()+1000*ttl,
    driveDeadline:driveSeconds+ttl,lastEnd:forwardEnds},strokeReceipt:null,
    byAsset:p.container===target?byAsset:{...byAsset,[assetId]:{...p,container:target}}});return true;
}
export function cancelStrokeDose(id:number){if(state().strokeOrder?.id!==id)return false;settleOrder('cancelled');return true;}
export function discardPelvicDoses(token:number,poseHeld=false){if(state().active?.token===token){doseCount=0;if(!poseHeld)lastInside=entering=false;settleOrder('cancelled');}}
/** One post-pose invocation per frame. The input is the solver's CURRENT outlet,
 * never the visual readout, target depth, or the selected model's last dose. */
export function consumePelvicDose(token:number,outlet:Pick<PelvicContact,'outletInside'|'outletVisible'>&{motion?:ContactMotion|null},gripStart=false):'none'|'internal'|'external'{
  const a=state().active;
  if(a?.token!==token||!a.running||blocked(a)||dispensed)return 'none';
  if(a.mode==='standAuto'){
    lastInside=outlet.outletInside;
    // A valid crossing can land exactly on the plane, then acquire usable
    // depth on a subsequent frame. The player may click between those two.
    const atEntry=outlet.motion==='enter'||entering&&outlet.motion==='inside';
    entering=atEntry&&!lastInside;
    const {strokeOrder:q,byAsset,support}=state();
    if(q){
      const p=byAsset[a.assetId];
      if(q.token!==token||q.target!==p.container||!canStartAtOpening(p,support[a.assetId])){settleOrder('cancelled');return 'none';}
      if(performance.now()>=q.deadline||driveSeconds>=q.driveDeadline){settleOrder('expired');return 'none';}
      if(!outlet.outletInside||(q.phase==='waiting'&&!atEntry)){
        if(q.phase==='dispatched'||forwardEnds!==q.lastEnd)settleOrder('missed');
        return 'none';
      }
      // Transfer the intent to the ordinary one-dose delivery path *now*,
      // using this very frame's measured outlet. No queued future delivery.
      doseTarget=q.target;doseCount=1;
    }
  }
  if(a.mode==='xrManual'){if(!gripStart||useBackpack.getState().selected)return 'none';}
  else {
    if(!doseCount)return 'none';doseCount--;
    // The named button requests one particular destination. A crossing,
    // withdrawal or loss between the click and render must not reroute it.
    if(doseTarget==='external'?outlet.outletInside||!outlet.outletVisible:!outlet.outletInside||doseTarget!==state().byAsset[a.assetId].container){doseCount=0;return 'none';}
  }
  dispensed=true;
  if(!outlet.outletInside){
    if(outlet.outletVisible)return 'external';
    doseCount=0;return 'none'; // No pending request from an unverified frame can fire on recovery.
  }
  const p=state().byAsset[a.assetId],k=p.container,amount=Math.min(limits.dose,p.capacity[k]-p.fluid[k]);
  const next={...p,fluid:{...p.fluid,[k]:p.fluid[k]+amount},overflow:p.overflow+(limits.dose-amount)};
  if(amount>0)recordInternalDose(a.assetId,amount,k);
  usePelvic.setState(s=>({byAsset:{...s.byAsset,[a.assetId]:next},...(s.strokeOrder?{strokeOrder:null,strokeReceipt:'delivered' as const}:{})}));return 'internal';
}
export function setPelvicCapacity(assetId:string,capacity:number){
  const p=state().byAsset[assetId];if(!selected(assetId)||!p||!Number.isFinite(capacity))return false;
  const k=p.container,max=clamp(capacity,limits.capacity),kept=Math.min(p.fluid[k],max);
  writeProfile(assetId,{...p,fluid:{...p.fluid,[k]:kept},capacity:{...p.capacity,[k]:max},overflow:p.overflow+(p.fluid[k]-kept)});return true;
}
export function drainPelvic(assetId:string,units:number=limits.dose){
  const p=state().byAsset[assetId];if(!selected(assetId)||!p||!Number.isFinite(units)||units<=0)return false;
  const k=p.container,amount=Math.min(p.fluid[k],units);if(!amount)return false;
  writeProfile(assetId,{...p,fluid:{...p.fluid,[k]:p.fluid[k]-amount},drained:p.drained+amount});return true;
}
export function clearPelvicFluid(assetId:string){
  const p=state().byAsset[assetId];if(!selected(assetId)||!p)return false;
  writeProfile(assetId,{...p,fluid:{...p.fluid,[p.container]:0}});return true;
}

useStagePlay.subscribe((s,p)=>{
  const a=state().active;if(a&&(a.mode==='xrManual'?s.held!==p.held:s.stand!==p.stand))dropBinding();
});
useHudWorldInput.subscribe((s,p)=>{const a=state().active;if(a?.source==='xr'&&s.blocked&&!p.blocked)interruptPelvic(a.token);});
useMmdVrStore.subscribe((s,p)=>{
  const a=state().active;
  if(s.prefs.scenery!==p.prefs.scenery||s.entryEpoch!==p.entryEpoch||p.overlayOpen&&!s.overlayOpen||s.presentation!==p.presentation){
    if(a)endPelvic(a.token);if(Object.keys(state().support).length)usePelvic.setState({support:{}});
  }else if(a&&(s.assetLoad.running||s.physicsBusy||s.physicsFatal||s.seekEpoch!==p.seekEpoch))interruptPelvic(a.token);
});
useBackpack.subscribe((b,p)=>{
  const a=state().active;
  if(a){
    const live=b.live[a.assetId];
    if(!live?.visible||live.runtimeId!==a.runtimeId||b.entries!==p.entries&&!b.entries.some(e=>e.id===a.assetId&&e.kind==='model')||
      isSoloFloorSession()&&b.selected!==p.selected&&b.selected!==a.assetId&&!(a.mode==='xrManual'&&a.awaitingWorld&&!b.selected))endPelvic(a.token);
    else if(b.busy||b.draft||b.selected!==p.selected&&b.selected&&(b.selected!==a.assetId||a.mode==='xrManual'))interruptPelvic(a.token);
    else if(a.awaitingWorld&&!b.selected&&p.selected===a.assetId&&!blocked(a))usePelvic.setState({active:{...a,awaitingWorld:false,running:true}});
  }
  const s=state();let profiles=s.byAsset,support=s.support;
  if(b.entries!==p.entries){
    const ids=new Set(b.entries.filter(e=>e.kind==='model').map(e=>e.id));
    for(const id of Object.keys(profiles))if(!ids.has(id))profiles=omit(profiles,id);
  }
  if(b.live!==p.live||b.entries!==p.entries){
    for(const [id,live] of Object.entries(support))if(!b.live[id]?.visible||b.live[id].runtimeId!==live.runtimeId||!b.entries.some(e=>e.id===id&&e.kind==='model'))support=omit(support,id);
  }
  if(profiles!==s.byAsset||support!==s.support)usePelvic.setState({byAsset:profiles,support});
});
