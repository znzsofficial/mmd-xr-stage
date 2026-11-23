import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import type {DiagramActor} from '../components/ActorDiagram';
import {PrivateButton,PrivateLine} from '../pelvic/HudPrivateControls';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {ObservationDiagram} from './ObservationDiagram';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';
import {usePelvic} from '../pelvic/store';
import {HudReproductionReadouts,ScreenReproductionReadouts,useUterusRecord} from './ReproductionReadouts';
import {stageLabel} from '../bodyState/reproduction/readings';
import './observation.css';

const parts=['vulva','vagina','uterus'] as const;
const zhNames={vulva:'外阴',vagina:'阴道',uterus:'子宫',front:'正面',oblique:'斜面',side:'侧面'};
const enNames={vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',front:'Front',oblique:'Oblique',side:'Side'};
const angles=['front','oblique','side'] as const;
function useBalance(id:string,part:ObservationAtlasPart,zh:boolean){
  const key=part==='uterus'?'fantasyUterine':'vaginal';
  return usePelvic(s=>{const p=s.byAsset[id];return !p||part==='vulva'||p.container===key?'':`${part==='uterus'?(zh?'宫腔存量':'Uterine amount'):(zh?'阴道存量':'Vaginal amount')}　${p.fluid[key]} / ${p.capacity[key]}`;});
}
function useMonitor(id:string){
  // The lens follows the player's choice. It never writes the dose destination
  // or decides which interaction is running. Only one part paints at a time.
  const [part,choose]=useState<ObservationAtlasPart>('vagina'),view=useAtlasView(id);
  const zh=useLanguageStore(s=>s.language==='zh');
  const balance=useBalance(id,part,zh);
  const record=useUterusRecord(id,part==='uterus',zh);
  const title=zh?'身体特写':'Body close-up';
  return {part,choose,names:zh?zhNames:enNames,title,heading:part==='uterus'&&!record?stageLabel(undefined,zh):title,loading:zh?'绘制中…':'Drawing…',balance,record,
    degrees:view.degrees,turn:(k:typeof angles[number])=>setAtlasView(id,{degrees:atlasAngles[k]})};
}

export function LivePelvicScreenView(actor:DiagramActor){
  const m=useMonitor(actor.assetId);
  return <section className="live-pelvic-view" aria-label={m.title}>
    <h4>{m.heading}<small>{m.balance}</small></h4>
    <div className="pelvic-keys live-pelvic-parts" role="group" aria-label={m.title}>{parts.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={k===m.part} onClick={()=>m.choose(k)}>{m.names[k]}</button>)}</div>
    <ObservationDiagram key={m.part} {...actor} part={m.part} loading={m.loading}/>
    <div className="pelvic-keys live-pelvic-angles">{angles.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={m.degrees===atlasAngles[k]} onClick={()=>m.turn(k)}>{m.names[k]}</button>)}</div>
    {m.record&&<ScreenReproductionReadouts record={m.record}/>}
  </section>;
}

/** Local bounds x ±widthM/2, y ±.68. Fixed control locations regardless of
 * figure, contact and fluid level. The surrounding workbench owns its paper. */
export function LivePelvicHudView({widthM,...actor}:DiagramActor&{widthM:number}){
  const m=useMonitor(actor.assetId),w=widthM,pitch=w/3,bw=pitch-.018;
  return <group name="observation:live-pane">
    <PrivateLine position={[0,.61,0]} width={w} text={m.heading} value={m.balance} title/>
    {parts.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,.455,0]} size={[bw,.137]} label={m.names[k]} active={k===m.part} variant="lens" onPress={()=>m.choose(k)}/>)}
    <group position-y={m.record ? .033 : -.07}><ObservationDiagram key={m.part} {...actor} part={m.part} widthM={Math.min(w,m.record ? .84 : 1.01)} loading={m.loading}/></group>
    {m.record&&<group position-y={-.365}><HudReproductionReadouts record={m.record} width={w}/></group>}
    {angles.map((k,i)=><PrivateButton key={k} position={[(i-1)*pitch,-.584,0]} size={[bw,.135]} label={m.names[k]} active={m.degrees===atlasAngles[k]} variant="lens" onPress={()=>m.turn(k)}/>)}
  </group>;
}
