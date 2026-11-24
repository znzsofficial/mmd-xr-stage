import { createMmdVrHapticDriver, getMmdVrHapticFeedback, type MmdVrHapticLevel } from '../../xr/contact/mmdVrHaptics';
import type { GripFrame } from '../propView';
import { useStagePlay } from '../stagePlay';
import { eggPowerAt, useRemoteEgg } from './remoteMotor';

/** No timers: an untracked/blocked frame, missing target or stowed transmitter
 * cannot schedule a pulse. The same waveform drives the receiver and the handset. */
export function createEggFeedback() {
  const driver=createMmdVrHapticDriver();
  let nextMs=0, activePad:Gamepad|null=null;
  const reset=()=>{activePad=null;nextMs=0;driver.stop();};
  function connect(){
    const off=useRemoteEgg.subscribe((s,p)=>{if(s.mode!==p.mode||s.assetId!==p.assetId)reset();});
    const hand=useStagePlay.subscribe((s,p)=>{if(s.held?.hand!==p.held?.hand||s.held?.toy!==p.held?.toy)reset();});
    return ()=>{off();hand();reset();};
  }
  return {reset,connect, update(frame:GripFrame,level:MmdVrHapticLevel,now:number){
    const pad=frame.usable&&frame.gamepad;
    const power=eggPowerAt(now);
    if(!pad||level==='off'||!power){if(activePad)reset();return;}
    if(pad!==activePad){reset();activePad=pad;}
    const switched=frame.action==='start';
    if(!switched && now<nextMs)return;
    nextMs=now+165;
    void driver.pulse(pad,getMmdVrHapticFeedback(switched?1.2:power,level),now);
  }};
}
