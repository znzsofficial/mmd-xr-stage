import {useLayoutEffect,useRef,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {chanceFor,useConception} from '../bodyState/reproduction/store';
import {RESULT_REVEAL_SECONDS} from '../bodyState/reproduction/pictureClock';
import {PrivateLine} from '../pelvic/HudPrivateControls';

export const CONCEPTION_REVEAL_MS=RESULT_REVEAL_SECONDS*1000;

/** One wake per delivery. Looking away, returning or changing the chance
 * never restarts the encounter or reveals a previous actor's result. */
export function useConceptionReadout(id:string,uterus:boolean,moving:boolean,showChance:boolean){
  const event=useConception(s=>uterus?s.byAsset[id]?.event:undefined);
  const chance=useConception(s=>uterus&&showChance?chanceFor(id,s):null);
  const chanceLabel=useLanguageStore(s=>s.t('actorChance')),zh=useLanguageStore(s=>s.language==='zh');
  const [revealed,reveal]=useState<typeof event>();
  const owner=useRef<typeof event>(undefined);
  useLayoutEffect(()=>{
    const fresh=owner.current!==event;owner.current=event;
    if(!event){reveal(undefined);return;}
    // Match the picture clock: a new frozen encounter opens on its final
    // frame, but freezing an approach already in progress holds that frame.
    if(!moving){if(fresh)reveal(event);return;}
    const remaining=event.at+CONCEPTION_REVEAL_MS-performance.now();
    if(remaining<=0){reveal(event);return;}
    const timer=window.setTimeout(()=>reveal(event),Math.ceil(remaining));
    return ()=>window.clearTimeout(timer);
  },[event,moving]);
  if(!uterus)return null;
  const pending=event&&event!==revealed;
  const result=!event?(zh?'尚无记录':'No result yet'):pending?(zh?'观察中…':'In progress…'):event.success?(zh?'已受精':'Fertilized'):(zh?'未受精':'Not fertilized');
  const rows=chance===null?[]:[{label:chanceLabel,value:`${chance}%`}];
  rows.push({label:zh?'最近结果':'Last result',value:result});return rows;
}
type Props={rows:NonNullable<ReturnType<typeof useConceptionReadout>>};
export function ScreenConceptionReadout({rows}:Props){
  return <dl className="uterus-record" aria-live="polite">{rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>;
}
export function HudConceptionReadout({rows,width}:Props&{width:number}){
  return <group name="observation:conception-result">{rows.map((r,i)=><PrivateLine key={r.label} position={[0,-i*.108,0]} width={width} text={r.label} value={r.value}/>)}</group>;
}
