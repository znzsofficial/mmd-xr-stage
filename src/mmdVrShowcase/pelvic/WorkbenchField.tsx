import type {CSSProperties} from 'react';
import {PrivateButton,PrivateLine,PrivateSlider} from './HudPrivateControls';
import type {Field} from './controlRows';

type Props={row:Field;blocked:boolean};
const formatted=(v:number,unit:string)=>`${+v.toFixed(2)}${unit}`;

export function ScreenField({row,blocked}:Props){
  return <label className="pelvic-field"><span>{row.label}<output>{formatted(row.value,row.unit)}</output></span>
    <input type="range" aria-label={row.label} value={row.value} min={row.range[0]} max={row.range[1]} step={row.step}
      style={{'--progress':`${(row.value-row.range[0])/(row.range[1]-row.range[0])*100}%`} as CSSProperties}
      disabled={blocked||row.disabled} onChange={e=>row.change(e.currentTarget.valueAsNumber)}/></label>;
}
export function HudField({row,blocked,width:w}:Props&{width:number}){
  return <><PrivateLine position={[0,.069,0]} width={w} text={row.label} value={formatted(row.value,row.unit)}/>
    <PrivateSlider position={[0,-.046,0]} width={w-.375} value={(row.value-row.range[0])/(row.range[1]-row.range[0])} disabled={blocked||row.disabled}
      onChange={v=>row.change(+(row.range[0]+Math.round(v*(row.range[1]-row.range[0])/row.step)*row.step).toFixed(4))}/>
    {([-1,1] as const).map(d=><PrivateButton key={d} position={[d*(w/2-.082),-.046,0]} size={[.164,.13]} label={d<0?'−':'+'}
      disabled={blocked||row.disabled||(d<0?row.value<=row.range[0]:row.value>=row.range[1])}
      onPress={()=>row.change(+Math.min(row.range[1],Math.max(row.range[0],row.value+d*row.step)).toFixed(4))}/>)}</>;
}
