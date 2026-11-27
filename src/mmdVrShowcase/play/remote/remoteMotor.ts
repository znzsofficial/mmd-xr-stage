import { create } from 'zustand';

export type RemoteMode = 0 | 1 | 2 | 3;
export type EggOffset = readonly [number, number, number];
const zero:EggOffset = [0, 0, 0];
export type EggSite='cloth'|'chest';
export const useRemoteEgg = create<{assetId:string|null; mode:RemoteMode; offset:EggOffset;site:EggSite}>(()=>({assetId:null,mode:0,offset:zero,site:'cloth'}));

// A rebind / coarse reset and back between two display frames is still a
// teleport. Small calibration commands instead move along a bounded path.
let placementEpoch=0;
useRemoteEgg.subscribe((s,p)=>{if(s.assetId!==p.assetId||s.site!==p.site||(s.offset!==p.offset&&
  Math.hypot(s.offset[0]-p.offset[0],s.offset[1]-p.offset[1],s.offset[2]-p.offset[2])>5))placementEpoch++;});
export const eggPlacementEpoch=()=>placementEpoch;

// A new wearer starts low. Re-opening the same actor's tools is not a start
// command (especially after Stop), nor does changing the transmitter hand refit it.
let modeStartedMs = 0;
export function startEggBinding(assetId:string) {
  if(useRemoteEgg.getState().assetId===assetId)return;
  modeStartedMs=performance.now();useRemoteEgg.setState({assetId, mode:1, offset:zero,site:'cloth'});
}
export function clearRemoteEgg() {
  if(useRemoteEgg.getState().assetId!==null) useRemoteEgg.setState({assetId:null,mode:0,offset:zero,site:'cloth'});
}
export function selectEggSite(site:EggSite){
  const state=useRemoteEgg.getState();if(state.assetId&&state.site!==site)useRemoteEgg.setState({site,offset:zero});
}
export function selectEggPattern(mode:Exclude<RemoteMode,0>) {
  const s=useRemoteEgg.getState();
  if(!s.assetId||s.mode===mode)return;
  modeStartedMs=performance.now();useRemoteEgg.setState({mode});
}
// The physical remote has one key: steady → rising → intermittent → off.
export function cycleRemoteEgg() {
  const {mode}=useRemoteEgg.getState();
  if(mode===3)stopRemoteEgg();else selectEggPattern(mode===0?1:mode===1?2:3);
}
export function stopRemoteEgg() {
  if(useRemoteEgg.getState().mode!==0)useRemoteEgg.setState({mode:0});
}
export function adjustRemoteEgg(axis:0|1|2,deltaCm:number) {
  const {assetId,offset}=useRemoteEgg.getState(); if(!assetId||!Number.isFinite(deltaCm))return;
  const next:[number,number,number]=[...offset];
  next[axis]=Math.max(-50,Math.min(50,offset[axis]+Math.round(deltaCm)));
  if(next[axis]!==offset[axis])useRemoteEgg.setState({offset:next});
}
export function resetEggOffset() {
  if(useRemoteEgg.getState().offset!==zero)useRemoteEgg.setState({offset:zero});
}
/** The envelope describes motor power, independently of the mesh vibration frequency. */
export function eggEnvelope(mode:RemoteMode,elapsedMs:number) {
  const ms=Math.max(0,elapsedMs);
  switch(mode){
    case 0: return 0;
    case 1: return .58;
    case 2: return .12+.88*((ms%3000)/3000);
    case 3: return ms%880<320 ? .92 : 0;
  }
}
export const eggElapsedAt=(nowMs:number)=>Math.max(0,nowMs-modeStartedMs);
export const eggPowerAt=(nowMs:number)=>eggEnvelope(useRemoteEgg.getState().mode,eggElapsedAt(nowMs));
