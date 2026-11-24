import type {World} from './gravityField';

/** Shell-height evaluations, not wall time. The motor writes before the XR
 * diagnostics callback closes the frame. A new planet visit owns a new bin. */
type Bin={sweeps:number;evaluations:number;frame:number;maxFrame:number;maxSweep:number;peakWorld:World['id']|null};
const fresh=():Bin=>({sweeps:0,evaluations:0,frame:0,maxFrame:0,maxSweep:0,peakWorld:null});
let current:Bin|null=null;
export function observeSweepWork(){const bin=current=fresh();return ()=>{if(current===bin)current=null;};}
export function recordShellSweep(evaluations:number,worstWorld:World['id']|null){
  const w=current;if(!w)return;
  w.sweeps++;w.evaluations+=evaluations;w.frame+=evaluations;
  if(evaluations>w.maxSweep){w.maxSweep=evaluations;w.peakWorld=worstWorld;}
}
export function finishSweepFrame(){const w=current;if(w){w.maxFrame=Math.max(w.frame,w.maxFrame);w.frame=0;}}
export function discardSweepWork(){if(current?.sweeps)Object.assign(current,fresh());}
export function takeSweepWork(){const w=current;if(!w?.sweeps)return;
  const {sweeps,evaluations,maxFrame,maxSweep,peakWorld}=w;discardSweepWork();return {sweeps,evaluations,maxFrame,maxSweep,peakWorld};
}
