import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import type {DiagramActor} from '../components/ActorDiagram';
import {PrivateButton,PrivateLine} from '../pelvic/HudPrivateControls';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {ObservationDiagram} from './ObservationDiagram';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';
import {usePelvic} from '../pelvic/store';
import {HudConceptionReadout,ScreenConceptionReadout,useConceptionReadout} from './ConceptionReadouts';
import './observation.css';

const parts=['vulva','vagina','uterus'] as const;
const zhNames={vulva:'外阴',vagina:'阴道',uterus:'子宫',front:'正面',oblique:'斜面',side:'侧面'};
const enNames={vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',front:'Front',oblique:'Oblique',side:'Side'};
const angles=['front','oblique','side'] as const;
function useBalance(id:string,part:ObservationAtlasPart,zh:boolean){
  const key=part==='uterus'?'fantasyUterine':'vaginal';
  return usePelvic(s=>{const p=s.byAsset[id];return !p||part==='vulva'||p.container===key?'':`${part==='uterus'?(zh?'宫腔存量':'Uterine amount'):(zh?'阴道存量':'Vaginal amount')}　${p.fluid[key]} / ${p.capacity[key]}`;});
}
export type LiveMonitorNavigation={lens?:{part:ObservationAtlasPart;select:(part:ObservationAtlasPart)=>void}};
function useMonitor(id:string,lens:LiveMonitorNavigation['lens']){
  // The lens follows the player's choice. It never writes the dose destination
  // or decides which interaction is running. Only one part paints at a time.
  const [localPart,chooseLocal]=useState<ObservationAtlasPart>('uterus'),view=useAtlasView(id);
  const part=lens?.part??localPart,choose=lens?.select??chooseLocal;
  const zh=useLanguageStore(s=>s.language==='zh');
  const balance=useBalance(id,part,zh);
  const record=useConceptionReadout(id,part==='uterus',view.motion,false);
  const title=zh?'身体特写':'Body close-up';
  return {part,choose,names:zh?zhNames:enNames,title,heading:part==='uterus'?(zh?'子宫 · 受精':'Uterus · Fertilization'):title,loading:zh?'绘制中…':'Drawing…',balance,record,
    degrees:view.degrees,turn:(k:typeof angles[number])=>setAtlasView(id,{degrees:atlasAngles[k]})};
}

export function LivePelvicScreenView({lens,...actor}:DiagramActor&LiveMonitorNavigation){
  const m=useMonitor(actor.assetId,lens);
  return <section className="live-pelvic-view" aria-label={m.title}>
    <div className="live-pelvic-heading"><h4>{m.heading}{m.balance&&<small>{m.balance}</small>}</h4></div>
    <div className="pelvic-keys live-pelvic-parts" role="group" aria-label={m.title}>{parts.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={k===m.part} onClick={()=>m.choose(k)}>{m.names[k]}</button>)}</div>
    <ObservationDiagram key={m.part} {...actor} part={m.part} fertility={m.part==='uterus'} loading={m.loading}/>
    <div className="pelvic-keys live-pelvic-angles">{angles.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={m.degrees===atlasAngles[k]} onClick={()=>m.turn(k)}>{m.names[k]}</button>)}</div>
    {m.record&&<ScreenConceptionReadout rows={m.record}/>}
  </section>;
}

/** The outcome has a fixed baseline below the picture, independent of the motor keys. */
export function LivePelvicHudView({widthM,lens,...actor}:DiagramActor&LiveMonitorNavigation&{widthM:number}){
  const m=useMonitor(actor.assetId,lens),w=widthM,pitch=w/3,bw=pitch-.018;
  return <group name="observation:live-pane">
    <PrivateLine position={[0,.61,0]} width={w} text={m.heading} value={m.balance} title/>
    {parts.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,.455,0]} size={[bw,.137]} label={m.names[k]} active={k===m.part} variant="lens" onPress={()=>m.choose(k)}/>)}
    <group position-y={m.record ? .016 : -.07}><ObservationDiagram key={m.part} {...actor} part={m.part} fertility={m.part==='uterus'} widthM={Math.min(w,m.record ? .89 : 1.01)} loading={m.loading}/></group>
    {m.record&&<group position-y={-.432}><HudConceptionReadout rows={m.record} width={w}/></group>}
    {angles.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,-.584,0]} size={[bw,.135]} label={m.names[k]} active={m.degrees===atlasAngles[k]} variant="lens" onPress={()=>m.turn(k)}/>)}
  </group>;
}
