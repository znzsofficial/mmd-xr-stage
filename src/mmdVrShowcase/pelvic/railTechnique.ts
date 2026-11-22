import {PELVIC_LIMITS} from './stateTypes';

/** Page-asset data only. Samples are signed fractions of the current fit's
 * approach / usable rail, at 60 Hz. The last point is exactly at `seconds`,
 * even when Save landed between two sample times. No pose or event stream. */
export type RailTechnique={readonly seconds:number;readonly positions:readonly number[]};
export const MAX_TAKE_SECONDS=20;
const hz=60,home=PELVIC_LIMITS.position[0];
const bounded=(p:number)=>Math.min(1,Math.max(home,p));
const mix=(a:number,b:number,k:number)=>a+(b-a)*k;
export function createRailRecorder(){
  const positions:number[]=[];let time=0,last:number=home,extent:number=home;
  const savable=()=>time>=.15&&extent>home+.01;
  function sample(dt:number,measured:number){
    if(!Number.isFinite(dt)||dt<0||!Number.isFinite(measured)||measured<home-1e-6||measured>1+1e-6)return false;
    const p=bounded(measured);
    if(!positions.length){
      if(p>home+1e-6)return false;
      positions.push(home);return true; // timing starts at the first presented frame
    }
    if(!dt||time===MAX_TAKE_SECONDS)return true;
    const end=Math.min(MAX_TAKE_SECONDS,time+dt);
    for(let index=positions.length;index/hz<=end;index++)positions.push(mix(last,p,(index/hz-time)/dt));
    last=mix(last,p,(end-time)/dt);time=end;extent=Math.max(extent,last);return true;
  }
  return {sample,hold:(dt:number)=>!!positions.length&&sample(dt,last),savable,seconds:()=>time,
    finish():RailTechnique|null{
      if(!savable())return null;
      const saved=[...positions];if((saved.length-1)/hz<time)saved.push(last);
      return {seconds:time,positions:saved};
    }};
}
function valueAt(clip:RailTechnique,t:number){
  const points=clip.positions,end=points.length-1;
  if(t>=clip.seconds)return points[end];
  const i=Math.min(end-1,Math.floor(t*hz)),start=i/hz;
  return mix(points[i],points[i+1],(t-start)/(Math.min((i+1)/hz,clip.seconds)-start));
}

/** The endpoints get real presentation frames. A loop with a buried end
 * retracts at motor speed and must observe its mounted outlet back at home.
 * Never wrap a clock directly from the last pose to the first. */
export function createRailReplay(clip:RailTechnique){
  // A slow display may span a short reversal entirely. Present the turning
  // point / start of a dwell, then spend the small remainder on the next tick.
  const corners:number[]=[];let previous=0;
  for(let i=1;i<clip.positions.length;i++){
    const diff=clip.positions[i]-clip.positions[i-1],sign=Math.abs(diff)<1e-7?0:Math.sign(diff);
    if(previous!==0&&sign!==previous)corners.push((i-1)/hz);previous=sign;
  }
  let t=0,p:number=home,corner=0,remainder=0,phase:'clip'|'endpoint'|'return'|'done'='clip';
  return {
    next(dt:number,rate:number,loop:boolean){
      if(phase==='endpoint')phase=loop?'return':'done';
      if(phase==='return')p=Math.max(home,p-dt*2);
      if(phase==='clip'){
        // Even at double speed on a slow frame the real outlet must not
        // jump through the approach. Spend no leftover time after a stall.
        const wanted=Math.min(clip.seconds,t+dt*rate+remainder),end=Math.min(wanted,corners[corner]??Infinity);
        // Recorded manual travel is limited to 2 rail units/s: .1 s spans
        // at most .2 rail units (6 cm even on the long exterior approach).
        const limited=Math.abs(valueAt(clip,end)-p)>.2;
        t=limited?Math.min(t+.1,end):end;
        if(t===corners[corner])corner++;
        remainder=limited?0:Math.min(dt*rate,wanted-t);
        p=valueAt(clip,t);if(t===clip.seconds)phase='endpoint';
      }
      return p;
    },
    presented(atHome:boolean,loop:boolean){
      if(phase==='return'&&p===home&&atHome){t=0;corner=0;remainder=0;phase=loop?'clip':'done';}
      return phase==='done';
    },
  };
}
