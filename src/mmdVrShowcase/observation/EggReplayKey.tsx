import {useRef} from 'react';
import {PrivateButton} from '../pelvic/HudPrivateControls';
import type {useEggReplay} from './useEggReplay';

type Props={replay:ReturnType<typeof useEggReplay>;position?:[number,number,number];width?:number};
export function EggReplayKey({replay:r,position,width=.50}:Props){
  const down=useRef<number>(undefined);
  if(position)return <PrivateButton position={position} size={[width,.135]} label={r.label} onPress={r.press} pressToken={r.token} disabled={r.disabled} variant={r.playing?'stop':'button'}/>;
  // A held Stop must not turn into Replay at the end of the picture.
  return <button type="button" className="pelvic-key" disabled={r.disabled} data-stop={r.playing||undefined}
    onPointerDown={()=>{down.current=r.token;}} onKeyDown={e=>{if(!e.repeat&&(e.key===' '||e.key==='Enter'))down.current=r.token;}}
    onClick={()=>{const token=down.current;down.current=undefined;if(token===undefined||token===r.token)r.press();}}><span>{r.label}</span></button>;
}
