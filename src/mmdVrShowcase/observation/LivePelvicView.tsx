import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {chanceFor,eggsFor,forceOvulation,MAX_EGGS,setConceptionChance,useConception} from '../bodyState/reproduction/store';
import type {DiagramActor} from '../components/ActorDiagram';
import {useHudWorldInput} from '../components/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import {PrivateButton,PrivateLine} from '../pelvic/HudPrivateControls';
import {HudField,ScreenField} from '../pelvic/WorkbenchField';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {ObservationDiagram} from './ObservationDiagram';
import {useEggReplay} from './useEggReplay';
import {EggReplayKey} from './EggReplayKey';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';
import {enablePelvic,patchPelvic,usePelvic} from '../pelvic/store';
import {HudConceptionReadout,ScreenConceptionReadout,useConceptionReadout} from './ConceptionReadouts';
import './observation.css';

const parts=['vulva','vagina','uterus','egg'] as const,angles=['front','oblique','side'] as const,rims=['off','elastic','remember'] as const;
const words={
  zh:{title:'身体特写',vulva:'外阴',vagina:'阴道',uterus:'子宫',egg:'卵子',front:'正面',oblique:'斜面',side:'侧面',angle:'观察角度',
    rim:'处女膜',off:'关',elastic:'弹性',remember:'记住首次',recorded:'首次进入已记录',awaiting:'等待首次有效进入',ovulate:'强制排卵',loading:'绘制中…',uterine:'宫腔存量',vaginal:'阴道存量'},
  en:{title:'Body close-up',vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',egg:'Egg',front:'Front',oblique:'Oblique',side:'Side',angle:'View angle',
    rim:'Hymen',off:'Off',elastic:'Elastic',remember:'Remember first',recorded:'First entry recorded',awaiting:'Awaiting first entry',ovulate:'Force ovulation',loading:'Drawing…',uterine:'Uterine amount',vaginal:'Vaginal amount'},
};
export type LiveMonitorNavigation={lens?:{part:ObservationAtlasPart;select:(part:ObservationAtlasPart)=>void}};
type Props=DiagramActor&LiveMonitorNavigation&{blocked:boolean};

function useMonitor({assetId:id,runtimeId,lens,blocked}:Props,source:'screen'|'xr'){
  const [localPart,chooseLocal]=useState<ObservationAtlasPart>('uterus'),view=useAtlasView(id);
  const part=lens?.part??localPart,choose=lens?.select??chooseLocal,t=useLanguageStore(s=>words[s.language==='zh'?'zh':'en']);
  const epoch=useMmdVrStore(s=>s.entryEpoch),scenery=useMmdVrStore(s=>s.prefs.scenery);
  const canEdit=()=>{
    const stage=useMmdVrStore.getState(),bag=useBackpack.getState();
    return !blocked&&!document.hidden&&stage.overlayOpen&&stage.presentation===source&&stage.entryEpoch===epoch&&stage.prefs.scenery===scenery&&
      !stage.physicsBusy&&!stage.physicsFatal&&!stage.assetLoad.running&&!(source==='xr'&&useHudWorldInput.getState().blocked)&&
      bag.selected===id&&bag.live[id]?.visible&&bag.live[id].runtimeId===runtimeId&&!bag.busy&&!bag.draft;
  };
  const eggs=useConception(s=>eggsFor(id,s)),chance=useConception(s=>chanceFor(id,s)),chanceLabel=useLanguageStore(s=>s.t('actorChance'));
  const rim=usePelvic(s=>s.byAsset[id]?.rimMode??'off'),memory=usePelvic(s=>s.byAsset[id]?.rimMemory);
  const balance=usePelvic(s=>{
    const p=s.byAsset[id],key=part==='uterus'?'fantasyUterine':part==='vagina'?'vaginal':null;
    return !p||!key||p.container===key?'':`${key==='fantasyUterine'?t.uterine:t.vaginal}　${p.fluid[key]} / ${p.capacity[key]}`;
  });
  const record=useConceptionReadout(id,part,view.motion,false);
  const replay=useEggReplay(id,runtimeId,record?.replayable);
  return {part,choose,t,record:part==='egg'&&!eggs.length?null:record,replay,balance,blocked,heading:t[part],degrees:view.degrees,turn:(k:typeof angles[number])=>setAtlasView(id,{degrees:atlasAngles[k]}),
    eggs,eggId:view.eggId,count:`${eggs.length} / ${MAX_EGGS}`,selectEgg:(eggId:number)=>setAtlasView(id,{eggId}),
    ovulate:()=>{if(canEdit()&&forceOvulation(id,runtimeId)){
      const added=eggsFor(id).at(-1);if(added)setAtlasView(id,{eggId:added.id});
    }},chance:{kind:'field' as const,label:chanceLabel,value:chance,unit:'%',range:[0,100] as const,step:5,disabled:false,
      change:(n:number)=>{if(canEdit())setConceptionChance(id,runtimeId,n);}},
    rim,rimNote:rim==='remember'?(memory?t.recorded:t.awaiting):'',setRim:(mode:typeof rims[number])=>{
      if(canEdit()&&mode!==rim&&enablePelvic(id,true))patchPelvic(id,{rimMode:mode});
    }};
}

export function LivePelvicScreenView(props:Props){
  const m=useMonitor(props,'screen'),{t,part}=m;
  const choices=<div className="pelvic-keys live-pelvic-parts" role="group" aria-label={t.title}>{parts.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={k===part} onClick={()=>m.choose(k)}>{t[k]}</button>)}</div>;
  return <section className="live-pelvic-view" aria-label={t.title} data-part={part}>
    {choices}
    <div className="live-pelvic-heading"><h4><span>{m.heading}</span><small>{part==='egg'?m.count:m.balance}</small></h4>
      {part==='egg'&&<button className="pelvic-key live-ovulate" type="button" disabled={m.blocked||m.eggs.length>=MAX_EGGS} onClick={m.ovulate}>{t.ovulate}</button>}</div>
    <div className="live-monitor-body"><ObservationDiagram key={part} assetId={props.assetId} runtimeId={props.runtimeId} part={part} replay={part==='egg'?m.replay.player:undefined} loading={t.loading}/>
    {part==='vulva'&&<div className="live-pelvic-rim" role="group" aria-label={t.rim}><div><span>{t.rim}</span> <small>{m.rimNote}</small></div><div className="pelvic-keys">{rims.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={k===m.rim} disabled={m.blocked} onClick={()=>m.setRim(k)}>{t[k]}</button>)}</div></div>}
    <div className="pelvic-keys live-pelvic-angles" role="group" aria-label={t.angle}>{angles.map(k=><button type="button" key={k} className="pelvic-key" aria-pressed={m.degrees===atlasAngles[k]} onClick={()=>m.turn(k)}>{t[k]}</button>)}</div>
    <div className="live-monitor-detail">
    {part==='egg'&&<div className="live-pelvic-eggs"><div className="pelvic-keys live-egg-choices" role="group" aria-label={t.egg}>
      {m.eggs.map(egg=><button type="button" key={egg.id} className="pelvic-key" aria-pressed={egg.id===m.eggId} onClick={()=>m.selectEgg(egg.id)}>{`${t.egg} ${egg.id}`}</button>)}</div>
      <ScreenField row={m.chance} blocked={m.blocked}/></div>}
    {m.record&&<ScreenConceptionReadout rows={m.record.rows}/>}
    {part==='egg'&&<EggReplayKey replay={m.replay}/>}</div></div>
  </section>;
}

// All Y values are measured from the top of the left column. Its footprint
// is constant even when a third egg, a result, or a rim receipt appears.
export const livePaneHeight=1.77;
export function LivePelvicHudView({widthM:w,...props}:Props&{widthM:number}){
  const m=useMonitor(props,'xr'),{t,part}=m,cols=(n:number,i:number)=>(i-(n-1)/2)*w/n;
  const egg=part==='egg',vulva=part==='vulva',pictureW=egg?.82:w;
  return <group name="observation:live-pane">
    {parts.map((k,i)=><PrivateButton key={k} position={[cols(4,i),-.069,0]} size={[w/4-.014,.137]} label={t[k]} active={k===part} variant="lens" onPress={()=>m.choose(k)}/>)}
    <PrivateLine position={[egg?-w*.29:0,-.218,0]} width={egg?w*.42:w} text={m.heading} value={egg?m.count:m.balance} title/>
    {egg&&<PrivateButton position={[w*.226,-.221,0]} size={[w*.548,.135]} label={t.ovulate} onPress={m.ovulate} disabled={m.blocked||m.eggs.length>=MAX_EGGS}/>}
    <group position-y={-(egg?.30:.275)-pictureW*.41}><ObservationDiagram key={part} assetId={props.assetId} runtimeId={props.runtimeId} part={part} replay={egg?m.replay.player:undefined} widthM={pictureW} loading={t.loading}/></group>
    {vulva&&<><PrivateLine position={[0,-1.196,0]} width={w} text={t.rim} value={m.rimNote}/>
      {rims.map((k,i)=><PrivateButton key={k} position={[cols(3,i),-1.327,0]} size={[w/3-.018,.135]} label={t[k]} active={k===m.rim} disabled={m.blocked} variant="lens" onPress={()=>m.setRim(k)}/>)}</>}
    {angles.map((k,i)=><PrivateButton key={k} position={[cols(3,i),vulva?-1.489:egg?-1.063:-1.212,0]} size={[w/3-.018,.135]} label={t[k]} active={m.degrees===atlasAngles[k]} variant="lens" onPress={()=>m.turn(k)}/>)}
    {egg&&<>{m.eggs.map((e,i)=><PrivateButton key={e.id} position={[cols(3,i),-1.22,0]} size={[w/3-.018,.135]} label={`${t.egg} ${e.id}`} active={e.id===m.eggId} variant="lens" onPress={()=>m.selectEgg(e.id)}/>)}
      <group position-y={-1.40}><HudField row={m.chance} blocked={m.blocked} width={w}/></group></>}
    {m.record&&<group position={[egg?-w*.268:0,egg?-1.62:-1.365,0]}><HudConceptionReadout rows={m.record.rows} width={egg?w*.464:w}/></group>}
    {egg&&<EggReplayKey replay={m.replay} position={[w*.24,-1.62,0]} width={w*.52}/>}
  </group>;
}
