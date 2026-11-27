import { create } from 'zustand';

type Speed = 0 | 1 | 2;
type Motor = {speed:Speed; startedMs:number};
// The motor belongs to the single equipped wand. Changing the holder does not
// restart it. Keep the menu/ownership entry point independent of rendering.
export const useWandMotor = create<Motor>(()=>({speed:0,startedMs:0}));
export const cycleWand = () => useWandMotor.setState(({speed})=>({speed:speed===0?1:speed===1?2:0,startedMs:performance.now()}));
export const stopWand = () => {if(useWandMotor.getState().speed)useWandMotor.setState({speed:0});};

// The manually advanced Fiber root has a session-relative clock in seconds.
// The motor starts on the performance timeline. Latch one time per tracked
// frame so the flex joint and the later contact pass use exactly the same beat.
const frameTimes=new WeakMap<XRFrame,number>();
export function wandFrameMs(frame:XRFrame|undefined,screenMs:number){
  if(!frame)return screenMs;
  let ms=frameTimes.get(frame);
  if(ms===undefined){ms=performance.now();frameTimes.set(frame,ms);}
  return ms;
}

// Both consumers read the same R3F frame timestamp, even across a long Bullet
// step. The integer counts beats; the fraction is the flex joint's orbit.
export const wandTurns = (motor:Motor,frameMs:number) =>
  Math.max(0,frameMs-motor.startedMs)*(motor.speed===1?4:motor.speed===2?7:0)/1000;

export function createWandRhythm(){
  let lastMotor:Motor|null=null,lastBeat=-1,accent=false;
  function reset(){lastMotor=null;lastBeat=-1;accent=false;}
  return {reset,clearAccent(){accent=false;},sample(motor:Motor,frameMs:number,onset:boolean){
    if(!motor.speed){reset();return null;}
    if(lastMotor!==motor){reset();lastMotor=motor;}
    // If this beat was already sent, carry a brief touch to the next beat.
    // Never play a second pulse in the same cycle, or replay missed cycles.
    accent ||= onset;
    const beat=Math.floor(wandTurns(motor,frameMs));
    if(beat===lastBeat)return null;
    lastBeat=beat;
    const power=accent?1.4:motor.speed===1?.16:.49;
    accent=false;return power;
  }};
}
