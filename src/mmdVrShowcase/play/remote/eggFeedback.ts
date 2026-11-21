import { createMmdVrHapticDriver, getMmdVrHapticFeedback, type MmdVrHapticLevel } from '../../mmdVrHaptics';
import type { GripFrame } from '../propView';
import { eggPowerAt, useRemoteEgg } from './remoteMotor';

/** No timers: an untracked/blocked frame, missing target or stowed transmitter
 * cannot schedule a pulse. The same waveform drives the receiver and the handset. */
export function createEggFeedback() {
  const driver=createMmdVrHapticDriver();
  let nextMs=0, activePad:Gamepad|null=null;
  const reset=()=>{activePad=null;nextMs=0;driver.reset();};
  return {reset, update(frame:GripFrame,level:MmdVrHapticLevel,now:number){
    const pad=frame.usable&&frame.gamepad;
    if(!pad||level==='off'||!useRemoteEgg.getState().assetId){if(activePad)reset();return;}
    if(pad!==activePad){reset();activePad=pad;}
    const switched=frame.action==='start', power=eggPowerAt(now);
    if(!switched && (power===0||now<nextMs))return;
    nextMs=now+165;
    void driver.pulse(pad,getMmdVrHapticFeedback(switched?1.2:power,level),now);
  }};
}
