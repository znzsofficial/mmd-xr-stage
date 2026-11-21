import { create } from 'zustand';

export type RemoteMode = 0 | 1 | 2 | 3;
export type EggOffset = readonly [number, number, number];
const zero:EggOffset = [0, 0, 0];
export const useRemoteEgg = create<{assetId:string|null; mode:RemoteMode; offset:EggOffset}>(()=>({assetId:null,mode:0,offset:zero}));

// The store publishes commands, not animation frames. Both LEDs and XR feedback
// sample the same monotonic phase, including when a running remote changes hands.
let modeStartedMs = 0;
export function startEggBinding(assetId:string) {
  if(useRemoteEgg.getState().assetId!==assetId) useRemoteEgg.setState({assetId, mode:0, offset:zero});
}
export function clearRemoteEgg() {
  if(useRemoteEgg.getState().assetId!==null) useRemoteEgg.setState({assetId:null,mode:0,offset:zero});
}
export function cycleRemoteEgg() {
  const s=useRemoteEgg.getState(); if(!s.assetId)return;
  modeStartedMs=performance.now(); useRemoteEgg.setState({mode:((s.mode+1)%4) as RemoteMode});
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
export const eggPowerAt=(nowMs:number)=>eggEnvelope(useRemoteEgg.getState().mode,nowMs-modeStartedMs);
