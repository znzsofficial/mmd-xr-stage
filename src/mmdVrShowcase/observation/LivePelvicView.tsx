import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import type {DiagramActor} from '../components/ActorDiagram';
import {PrivateButton,PrivateLine} from '../pelvic/HudPrivateControls';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {ObservationDiagram} from './ObservationDiagram';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';
import {usePelvic} from '../pelvic/store';
import './observation.css';

const parts=['vulva','vagina','uterus'] as const;
const zhNames={vulva:'外阴',vagina:'阴道',uterus:'子宫',front:'正面',oblique:'斜面',side:'侧面'};
const enNames={vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',front:'Front',oblique:'Oblique',side:'Side'};
const angles=['front','oblique','side'] as const;
function useBalance(id:string,part:ObservationAtlasPart,zh:boolean){
  const key=part==='uterus'?'fantasyUterine':'vaginal';
  return usePelvic(s=>{const p=s.byAsset[id];return !p||part==='vulva'?'':`${part==='uterus'?(zh?'宫腔存量':'Uterine amount'):(zh?'阴道存量':'Vaginal amount')}　${p.fluid[key]} / ${p.capacity[key]}`;});
}
function useMonitor(id:string){
  // The lens follows the player's choice. It never writes the dose destination
  // or decides which interaction is running. Only one part paints at a time.
  const [part,choose]=useState<ObservationAtlasPart>('vagina'),view=useAtlasView(id);
  const zh=useLanguageStore(s=>s.language==='zh');
  const balance=useBalance(id,part,zh);
  return {part,choose,names:zh?zhNames:enNames,title:zh?'实时观察':'Live view',loading:zh?'绘制中…':'Drawing…',balance,
    degrees:view.degrees,turn:(k:typeof angles[number])=>setAtlasView(id,{degrees:atlasAngles[k]})};
}

export function LivePelvicScreenView(actor:DiagramActor){
  const m=useMonitor(actor.assetId);
  return <section className="live-pelvic-view" aria-label={m.title}>
    <h4>{m.title}<small>{m.balance}</small></h4>
    <div className="pelvic-keys" role="group" aria-label={m.title}>{parts.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={k===m.part} onClick={()=>m.choose(k)}>{m.names[k]}</button>)}</div>
    <ObservationDiagram key={m.part} {...actor} part={m.part} loading={m.loading}/>
    <div className="pelvic-keys live-pelvic-angles">{angles.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={m.degrees===atlasAngles[k]} onClick={()=>m.turn(k)}>{m.names[k]}</button>)}</div>
  </section>;
}

/** Local bounds x ±widthM/2, y ±.68. Fixed control locations regardless of
 * figure, contact and fluid level. The surrounding workbench owns its paper. */
export function LivePelvicHudView({widthM,...actor}:DiagramActor&{widthM:number}){
  const m=useMonitor(actor.assetId),w=widthM,pitch=w/3,bw=pitch-.018;
  return <group name="observation:live-pane">
    <PrivateLine position={[0,.61,0]} width={w} text={m.title} value={m.balance} title/>
    {parts.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,.455,0]} size={[bw,.137]} label={m.names[k]} active={k===m.part} variant="tab" onPress={()=>m.choose(k)}/>)}
    <group position-y={-.07}><ObservationDiagram key={m.part} {...actor} part={m.part} widthM={Math.min(w,1.01)} loading={m.loading}/></group>
    {angles.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,-.584,0]} size={[bw,.135]} label={m.names[k]} active={m.degrees===atlasAngles[k]} onPress={()=>m.turn(k)}/>)}
  </group>;
}
