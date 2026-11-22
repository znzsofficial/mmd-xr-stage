import { create } from 'zustand';
import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { useStagePlay, type Hand } from '../play/stagePlay';
import { defaultPelvicCalibration, type PelvicCalibration, type PelvicContact, type PelvicXYZ } from './contract';
import { canStartAtOpening, PELVIC_LIMITS as limits, type PelvicActive, type PelvicDoseTarget, type PelvicMode, type PelvicPatch, type PelvicProfile, type PelvicSample, type PelvicSupport } from './stateTypes';

export * from './stateTypes';

type State = { byAsset:Record<string,PelvicProfile>; active:PelvicActive|null; sample:PelvicSample|null; parkedSample:PelvicSample|null; support:Record<string,PelvicSupport> };
export const usePelvic = create<State>(()=>({byAsset:{},active:null,sample:null,parkedSample:null,support:{}}));
const state=usePelvic.getState;
const outside=limits.position[0];
let sequence=0;
// Only this clock owns the continuous rail position. React gets a decimated
// copy with measured geometry, never a notification per controller frame.
let position:number=outside, direction=1, doseCount=0, publishIn=0, seed=true, dispensed=false;
let doseTarget:PelvicDoseTarget='vaginal';
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
export function patchPelvic(assetId:string,patch:PelvicPatch){
  const p=state().byAsset[assetId];if(!selected(assetId)||!p)return false;
  const clothed=patch.clothingClear||patch.calibration?false:patch.clothed??!!p.clothed;
  const clothingClear=clothed?false:patch.clothingClear??(!patch.calibration&&p.clothingClear);
  const geometryChanged=!!patch.calibration||p.clothingClear!==clothingClear||!!p.clothed!==clothed;
  const active=state().active;
  if(geometryChanged&&active?.assetId===assetId)park(active);
  if(patch.container&&patch.container!==p.container&&active?.assetId===assetId)doseCount=0;
  writeProfile(assetId,{...p,calibration:patch.calibration?calibrate(p.calibration,patch.calibration):p.calibration,
    clothingClear,clothed,showAdapter:patch.showAdapter??p.showAdapter,
    container:patch.container==='vaginal'||patch.container==='fantasyUterine'?patch.container:p.container,
    speedHz:limited(patch.speedHz,p.speedHz,limits.speedHz),stroke:limited(patch.stroke,p.stroke,limits.stroke)});
  return true;
}
export function publishPelvicSupport(assetId:string,support:PelvicSupport){
  const bag=useBackpack.getState(),live=bag.live[assetId];
  if(!live?.visible||live.runtimeId!==support.runtimeId||state().support[assetId]===support)return;
  const a=state().active;
  if(support.kind==='missing'&&a?.assetId===assetId)interruptPelvic(a.token);
  usePelvic.setState(s=>({support:{...s.support,[assetId]:support}}));
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
function park(a:PelvicActive){
  position=outside;direction=1;doseCount=0;publishIn=0;seed=true;dispensed=false;
  usePelvic.setState({active:{...a,token:++sequence,running:false,awaitingWorld:false,position},sample:null,parkedSample:null});
}
function dropBinding(){
  position=outside;direction=1;doseCount=0;publishIn=0;seed=true;dispensed=false;
  usePelvic.setState({active:null,sample:null,parkedSample:null});
}
/** Explicit command only; neither wearing, selecting, nor calibrating takes a toy. */
export function assignPelvic(assetId:string,mode:PelvicMode,source:PelvicActive['source'],hand:Hand='right'){
  const {byAsset,support}=state(),live=useBackpack.getState().live[assetId],stage=useMmdVrStore.getState();
  if(!selected(assetId)||!byAsset[assetId]||source!==stage.presentation||blocked({assetId,source})||
    (mode==='xrManual'&&source!=='xr')||support[assetId]?.runtimeId!==live.runtimeId||support[assetId].kind==='missing')return false;
  const play=useStagePlay.getState();
  if(mode==='xrManual'){
    if(play.held?.toy!=='dildo'||play.held.hand!==hand)play.equip('dildo',hand);
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
  usePelvic.setState({active:{...a,token:++sequence,awaitingWorld,running:!awaitingWorld},sample:null,parkedSample:null});return true;
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
  doseCount=0;publishIn=0;seed=true;dispensed=false;
  usePelvic.setState({active:{...a,position,token:++sequence,running:false,awaitingWorld:false},sample:null,parkedSample:null});return true;
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
  const a=state().active;if(a?.assetId!==assetId||!a.running||blocked(a)||a.mode!=='standManual'||!Number.isFinite(deltaNormalized))return false;
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
  if(a.mode==='standManual'){
    const delta=a.position-position;
    position+=Math.sign(delta)*Math.min(Math.abs(delta),dt*2);
  }else if(a.mode==='standAuto'){
    const {speedHz,stroke}=state().byAsset[a.assetId];
    // Reflect a continuous position at the two ends. A live stroke reduction
    // retracts at the motor speed rather than snapping to the new end point.
    const distance=dt*2*speedHz*(stroke-outside);
    if(position>stroke){direction=-1;position=Math.max(stroke,position-distance);}
    else{
      position+=direction*distance;
      if(position>=stroke){position=stroke-(position-stroke);direction=-1;}
      else if(position<=outside){position=outside+(outside-position);direction=1;}
    }
  }
  return position;
}
const snapshot=(sample:PelvicSample)=>({...sample,tip:copyXYZ(sample.tip),tail:copyXYZ(sample.tail),shaft:sample.shaft?.map(copyXYZ)});
/** Idle geometry is read from the mounted mesh. It deliberately has no
 * crossing history and cannot authorize motor, aperture, physics or dosing. */
export function publishParkedSample(token:number,sample:PelvicSample){
  const a=state().active;if(a?.token!==token||a.running||a.awaitingWorld||a.mode==='xrManual')return;
  const prev=state().parkedSample;
  // The rail is rigid relative to the socket. A dancing actor should not
  // rerender every diagram merely due to floating point roundoff in that fit.
  if(prev&&Math.abs(prev.radiusM-sample.radiusM)<1e-6&&Math.abs(prev.lengthM-sample.lengthM)<1e-6&&
    sample.tip.every((n,i)=>Math.abs(prev.tip[i]-n)<1e-6)&&sample.tail.every((n,i)=>Math.abs(prev.tail[i]-n)<1e-6))return;
  usePelvic.setState({parkedSample:{...snapshot(sample),atCervix:false,depth:0,outletInside:false,outletVisible:false}});
}
export function publishPelvicSample(token:number,sample:PelvicSample){
  const a=state().active;if(a?.token!==token||!a.running||blocked(a))return false;
  if(![sample.depth,sample.angleDeg,sample.radiusM,sample.lengthM].every(Number.isFinite)||!finiteXYZ(sample.tip)||!finiteXYZ(sample.tail)||
      sample.shaft&&!sample.shaft.every(finiteXYZ)){interruptPelvic(token);return false;}
  const prev=state().sample;
  if(prev&&publishIn>0&&prev.outletInside===sample.outletInside&&prev.outletVisible===sample.outletVisible&&prev.exteriorCovered===sample.exteriorCovered&&prev.atCervix===sample.atCervix&&prev.aligned===sample.aligned)return true;
  publishIn=.1;
  usePelvic.setState({active:a.mode==='standAuto'&&a.position!==position?{...a,position}:a,sample:snapshot(sample)});return true;
}

export function requestPelvicDose(assetId:string,target:PelvicDoseTarget){
  const {active:a,sample,byAsset}=state();
  if(a?.assetId!==assetId||!a.running||a.mode==='xrManual'||blocked(a)||!sample)return false;
  if(target==='external'?sample.outletInside||!sample.outletVisible:target!==byAsset[assetId].container||!sample.outletInside)return false;
  if(doseTarget!==target)doseCount=0;
  doseTarget=target;doseCount++;return true;
}
export function discardPelvicDoses(token:number){if(state().active?.token===token)doseCount=0;}
/** One post-pose invocation per frame. The input is the solver's CURRENT outlet,
 * never the visual readout, target depth, or the selected model's last dose. */
export function consumePelvicDose(token:number,outlet:Pick<PelvicContact,'outletInside'|'outletVisible'>,gripStart=false):'none'|'internal'|'external'{
  const a=state().active;
  if(a?.token!==token||!a.running||blocked(a)||dispensed)return 'none';
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
  writeProfile(a.assetId,{...p,fluid:{...p.fluid,[k]:p.fluid[k]+amount},overflow:p.overflow+(limits.dose-amount)});return 'internal';
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
    if(!live?.visible||live.runtimeId!==a.runtimeId||b.entries!==p.entries&&!b.entries.some(e=>e.id===a.assetId&&e.kind==='model'))endPelvic(a.token);
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
