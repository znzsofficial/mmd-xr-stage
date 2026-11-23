import {useLayoutEffect,useRef,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {chanceFor,eggsFor,MAX_EGGS,useConception} from '../bodyState/reproduction/store';
import {RESULT_REVEAL_SECONDS} from '../bodyState/reproduction/pictureClock';
import {PrivateLine} from '../pelvic/HudPrivateControls';
import {useAtlasView} from '../pelvic/atlas/view';
import type {ObservationPart} from './ActorObservation';

export const CONCEPTION_REVEAL_MS=RESULT_REVEAL_SECONDS*1000;

/** One wake per delivery. Looking away, returning or changing the chance
 * never restarts the encounter or reveals a previous actor's result. */
export function useConceptionReadout(id:string,part:ObservationPart,moving:boolean,showChance:boolean){
  const {eggId}=useAtlasView(id),active=part==='egg'||part==='uterus';
  const egg=useConception(s=>part==='egg'?eggsFor(id,s).find(e=>e.id===eggId):undefined);
  const last=useConception(s=>part==='uterus'?s.byAsset[id]?.event:undefined),event=egg?.event??last;
  const chance=useConception(s=>active&&showChance?chanceFor(id,s):null);
  const chanceLabel=useLanguageStore(s=>s.t('actorChance')),zh=useLanguageStore(s=>s.language==='zh');
  const [revealed,reveal]=useState<typeof event>();
  const owner=useRef<{part:ObservationPart;event:typeof event}>(undefined);
  useLayoutEffect(()=>{
    const fresh=owner.current?.event!==event||owner.current?.part!==part;owner.current={part,event};
    if(!event){reveal(undefined);return;}
    // Match the picture clock: a new frozen encounter opens on its final
    // frame, but freezing an approach already in progress holds that frame.
    if(!moving){if(fresh)reveal(event);return;}
    const remaining=event.at+CONCEPTION_REVEAL_MS-performance.now();
    if(remaining<=0){reveal(event);return;}
    const timer=window.setTimeout(()=>reveal(event),Math.ceil(remaining));
    return ()=>window.clearTimeout(timer);
  },[event,moving,part]);
  if(!active)return null;
  const pending=event&&event!==revealed;
  const result=!event?(egg?(zh?'待受精':'Available'):(zh?'尚无记录':'No result yet')):pending?(zh?'观察中…':'In progress…'):event.success?(zh?'已受精':'Fertilized'):(zh?'未受精':'Not fertilized');
  const rows=chance===null?[]:[{label:chanceLabel,value:`${chance}%`}];
  if(part==='egg'&&!egg)rows.push({label:zh?'卵子数量':'Egg count',value:`0 / ${MAX_EGGS}`});
  else rows.push({label:egg?`${zh?'卵子':'Egg'} ${egg.id}`:zh?'最近结果':'Last result',value:result});return rows;
}
type Props={rows:NonNullable<ReturnType<typeof useConceptionReadout>>};
export function ScreenConceptionReadout({rows}:Props){
  return <dl className="uterus-record" aria-live="polite">{rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>;
}
export function HudConceptionReadout({rows,width}:Props&{width:number}){
  return <group name="observation:conception-result">{rows.map((r,i)=><PrivateLine key={r.label} position={[0,-i*.108,0]} width={width} text={r.label} value={r.value}/>)}</group>;
}
