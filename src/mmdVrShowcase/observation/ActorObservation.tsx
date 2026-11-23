import {useLayoutEffect,useRef,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {ObservationDiagram} from './ObservationDiagram';
import {useEggReplay} from './useEggReplay';
import {EggReplayKey} from './EggReplayKey';
import {HudConceptionReadout,ScreenConceptionReadout,useConceptionReadout} from './ConceptionReadouts';
import {setBreastView,useBreastView} from '../bodyState/breast/view';
import {areolaNames,areolaStyles} from '../bodyState/breast/art/areola';
import {useBodyState} from '../bodyState/store';
import {eggsFor,useConception} from '../bodyState/reproduction/store';
import {actorBinding,actorRodSample,type ObservationAtlasPart} from '../pelvic/atlas/painter';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {PrivateButton,PrivateLine,PrivateSheet,PrivateSlider} from '../pelvic/HudPrivateControls';
import {outletLabel} from '../pelvic/sectionProjection';
import {usePelvic} from '../pelvic/store';
import {foldNames,foldStyles} from '../pelvic/vulvaForm';
import '../pelvic/controls.css';
import './observation.css';

export type ObservationPart='breast'|ObservationAtlasPart;
export type ObservationProps={assetId:string;runtimeId:string;onBack:()=>void;initialPart?:ObservationPart;backLabel?:string};
const parts=['breast','vulva','vagina','uterus','egg'] as const;
const presets=['front','oblique','side'] as const;
const words={
  zh:{title:'身体观察',back:'返回角色',breast:'乳房',vulva:'外阴',vagina:'阴道',uterus:'子宫',egg:'卵子',part:'观察部位',angle:'观察角度',front:'正面',oblique:'斜面',side:'侧面',
    freeze:'定格图像',play:'播放图像',drag:'横拖图面旋转',labels:'结构标注',cut:'剖面',source:'数据来源',standard:'默认示意',preview:'当前预览',saved:'角色设定',
    fullness:'饱满度',milk:'存量（左 / 右）',rod:'杆位',none:'无杆位采样',depth:'在内深度',vaginal:'阴道精液',unit:'游戏单位'},
  en:{title:'Body observation',back:'Back to actor',breast:'Breast',vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',egg:'Egg',part:'Body part',angle:'View angle',front:'Front',oblique:'Oblique',side:'Side',
    freeze:'Freeze figure',play:'Animate figure',drag:'Drag across the figure to rotate',labels:'Labels',cut:'Cutaway',source:'Source',standard:'Default study',preview:'Current preview',saved:'Actor settings',
    fullness:'Fullness',milk:'Stored (L / R)',rod:'Rod',none:'No rod sample',depth:'Inside depth',vaginal:'Vaginal semen',unit:'game u.'},
};
function useView({assetId,runtimeId,initialPart='breast'}:ObservationProps){
  const [part,choose]=useState(initialPart);
  const zh=useLanguageStore(s=>s.language==='zh'),t=zh?words.zh:words.en;
  const chest=useBreastView(assetId),atlas=useAtlasView(assetId),breast=part==='breast';
  const eggs=useConception(s=>part==='egg'?eggsFor(assetId,s):undefined);
  const view=breast?chest:atlas;
  const set=breast?setBreastView:setAtlasView;
  const {degrees,motion}=view;
  const record=useConceptionReadout(assetId,part,motion,true),replay=useEggReplay(assetId,runtimeId,record?.replayable);
  const moving=replay.playing?!replay.paused:motion;
  return {part,choose,t,zh,degrees,record,replay,turn:(degrees:number)=>set(assetId,{degrees}),
    eggs:eggs?.map(e=>({label:`${t.egg} ${e.id}`,active:e.id===atlas.eggId,press:()=>setAtlasView(assetId,{eggId:e.id})})),
    transport:{label:moving?t.freeze:t.play,active:!moving,press:()=>replay.playing?replay.player.pause(moving):set(assetId,{motion:!motion})},
    areola:breast&&!chest.section?areolaStyles.map(style=>({label:areolaNames[zh?'zh':'en'][style],active:style===chest.areolaStyle,
      press:()=>setBreastView(assetId,{areolaStyle:style})})):[],areolaLabel:zh?'乳晕与乳头':'Areola & nipple',
    shapes:part==='vulva'?foldStyles.map(f=>({label:foldNames[zh?'zh':'en'][f],active:f===atlas.foldStyle,press:()=>setAtlasView(assetId,{foldStyle:f})})):[],
    options:[...(breast?[{label:t.cut,active:chest.section,press:()=>setBreastView(assetId,{section:!chest.section})}]:[]),
      ...(part==='uterus'||breast&&chest.section?[{label:t.labels,active:view.labels,press:()=>set(assetId,{labels:!view.labels})}]:[])],
  };
}
const percent=(n:number)=>`${Math.round(n*100)}%`;
function useReadings(assetId:string,runtimeId:string,{part,zh,t}:ReturnType<typeof useView>){
  const reproduction=part==='uterus'||part==='egg';
  const saved=useBodyState(s=>reproduction?undefined:s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId]);
  const draft=useBodyState(s=>!reproduction&&s.draft?.assetId===assetId);
  const pelvic=part==='vagina'||part==='vulva',p=usePelvic(s=>pelvic?s.byAsset[assetId]:undefined);
  const rod=usePelvic(s=>p?actorRodSample(s,assetId,runtimeId):null);
  const running=usePelvic(s=>!!p&&actorBinding(s,assetId,runtimeId)?.running===true);
  if(reproduction)return [];
  const lines=[{label:t.source,value:saved?(draft?t.preview:t.saved):t.standard}];
  if(part==='breast'&&saved){
    lines.push({label:t.fullness,value:percent(saved.fullness)});
    if(saved.lactating)lines.push({label:t.milk,value:`${percent(saved.left)} / ${percent(saved.right)}`});
  }
  if(pelvic){lines.push({label:t.rod,value:rod?outletLabel(rod,zh,!running):t.none});
    if(part==='vulva'&&p?.rimMode==='remember')lines.push({label:zh?'首次进入事件':'First entry event',value:p.rimMemory?(zh?'已记录':'Recorded'):(zh?'等待有效跨越':'Awaiting crossing')});
    if(running&&rod?.outletInside)lines.push({label:t.depth,value:`${(rod.depth*100).toFixed(1)} cm`});
    if(p&&part==='vagina')lines.push({label:t.vaginal,value:`${+p.fluid.vaginal.toFixed(2)} / ${+p.capacity.vaginal.toFixed(2)} ${t.unit}`});
  }
  return lines;
}

function Screen(props:ObservationProps){
  const {assetId,runtimeId,onBack,backLabel}=props,actor={assetId,runtimeId};
  const view=useView(props),{t,part,degrees,turn,record,replay}=view;
  const readings=useReadings(assetId,runtimeId,view);
  const sheet=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const sidebar=sheet.current?.closest('.screen-library');if(sidebar)sidebar.scrollTop=0;},[]);
  return <div ref={sheet} className="pelvic-screen actor-observation" role="group" aria-label={t.title}>
    <div className="observation-navigation">
      <header className="pelvic-heading"><h3>{t.title}</h3><button type="button" className="pelvic-key pelvic-back" onClick={onBack}>{backLabel??t.back}</button></header>
      <div className="pelvic-nav"><div className="pelvic-keys" role="group" aria-label={t.part}>{parts.map(k=><button className="pelvic-key" type="button" key={k} aria-pressed={part===k} onClick={()=>view.choose(k)}>{t[k]}</button>)}</div></div>
      <div className="pelvic-keys observation-presets" role="group" aria-label={t.angle}>{presets.map(k=><button className="pelvic-key" type="button" key={k} aria-pressed={degrees===atlasAngles[k]} onClick={()=>turn(atlasAngles[k])}>{t[k]}</button>)}</div>
    </div>
    <figure><ObservationDiagram key={part} {...actor} part={part} replay={part==='egg'?replay.player:undefined} loading={view.zh?'正在绘制图像…':'Drawing figure…'}/>
      <figcaption>{t.drag}<output aria-label={t.angle}>{degrees}°</output></figcaption></figure>
    {!!view.eggs?.length&&<div className="pelvic-keys" role="group" aria-label={t.egg}>{view.eggs.map(e=><button type="button" className="pelvic-key" key={e.label} aria-pressed={e.active} onClick={e.press}>{e.label}</button>)}</div>}
    {record&&<ScreenConceptionReadout rows={record.rows}/>}
    <div className="pelvic-keys">{[view.transport,...view.options].map(a=><button type="button" className="pelvic-key" key={a===view.transport?'transport':a.label} aria-pressed={a.active} onClick={a.press}>{a.label}</button>)}
      {part==='egg'&&<EggReplayKey replay={replay}/>}</div>
    {view.areola.length>0&&<fieldset className="observation-areola"><legend>{view.areolaLabel}</legend><div className="pelvic-keys">{view.areola.map(a=><button type="button" key={a.label} className="pelvic-key" aria-pressed={a.active} onClick={a.press}>{a.label}</button>)}</div></fieldset>}
    {view.shapes.length>0&&<div role="group" aria-label={view.zh?'外阴外形':'Fold shape'} className="pelvic-keys observation-presets">{view.shapes.map(s=><button type="button" key={s.label} className="pelvic-key" aria-pressed={s.active} onClick={s.press}>{s.label}</button>)}</div>}
    {readings.length>0&&<dl>{readings.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>}
  </div>;
}

function Hud(props:ObservationProps){
  const {assetId,runtimeId,onBack,backLabel}=props,actor={assetId,runtimeId};
  const view=useView(props),{t,part,degrees,turn,record,replay}=view;
  const readings=useReadings(assetId,runtimeId,view);
  // Back, part, angle and artwork stay fixed. The exterior style row has its
  // own space between the bottom of the picture and the first measurement.
  const left=-.284,art=.86,right=.452,rail=.506;
  // The actor anchor can sit near either edge of the forward view. Keep the
  // sheet close to the width of the actor menu; long rod verdicts get a full
  // line under the figure, not a narrow rail at the outside edge of one eye.
  const rod=readings.find(r=>r.label===t.rod),fields=readings.filter(r=>r!==rod);
  const rodY=part==='vulva'?-.67:-.592,firstY=rod?rodY-.104:view.areola.length?-.735:-.592;
  const recordY=part==='egg'?-.675:-.592,bottom=record?recordY-.19:firstY-Math.floor((fields.length-1)/2)*.11-.08;
  return <group name="observation:controls" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <group position-y={(.69+bottom)/2}><PrivateSheet size={[1.51,.69-bottom]}/></group>
    <PrivateLine position={[-.265,.586,0]} width={.90} title text={t.title}/>
    <PrivateButton position={[right,.586,0]} size={[rail,.14]} label={backLabel??t.back} variant="quiet" onPress={onBack}/>
    {parts.map((k,i)=><PrivateButton key={k} position={[(i-2)*.291,.408,0]} size={[.273,.145]} label={t[k]} active={part===k} variant="tab" onPress={()=>view.choose(k)}/>)}
    {presets.map((k,i)=><PrivateButton key={k} position={[left+(i-1)*.295,.222,0]} size={[.273,.142]} label={t[k]} active={degrees===atlasAngles[k]} onPress={()=>turn(atlasAngles[k])}/>)}
    <PrivateButton position={[right,.222,0]} size={[rail,.142]} label={view.transport.label} active={view.transport.active} onPress={view.transport.press}/>
    <group position={[left,-.194,0]}><ObservationDiagram key={part} {...actor} part={part} replay={part==='egg'?replay.player:undefined} widthM={art} loading={view.zh?'正在绘制图像…':'Drawing figure…'}/></group>
    <PrivateLine position={[right,.04,0]} width={rail} text={t.angle} value={`${degrees}°`}/>
    <PrivateSlider position={[right,-.088,0]} width={rail} disabled={false} value={(degrees+90)/180} onChange={v=>turn(v*180-90)}/>
    {view.options.map((a,i)=><PrivateButton key={a.label} position={[right,-.26-i*.17,0]} size={[rail,.14]} label={a.label} active={a.active} onPress={a.press}/>)}
    {view.shapes.map((a,i)=><PrivateButton key={a.label} position={[right,-.22-i*.15,0]} size={[rail,.135]} label={a.label} active={a.active} onPress={a.press}/>)}
    {view.eggs?.map((e,i)=><PrivateButton key={e.label} position={[right,-.23-i*.152,0]} size={[rail,.135]} label={e.label} active={e.active} onPress={e.press}/>)}
    {view.areola.length>0&&<group name="observation:areola" position-y={-.574}>
      <PrivateLine position={[-.455,0,0]} width={.50} text={view.areolaLabel}/>
      {view.areola.map((a,i)=><PrivateButton key={a.label} position={[.028+i*.462,0,0]} size={[.43,.14]} label={a.label} active={a.active} onPress={a.press}/>)}
    </group>}
    {record&&<group position={[part==='egg'?left:0,recordY,0]}><HudConceptionReadout rows={record.rows} width={part==='egg'?art:1.41}/></group>}
    {part==='egg'&&<EggReplayKey replay={replay} position={[right,recordY-.054,0]} width={rail}/>}
    {rod&&<PrivateLine position={[0,rodY,0]} width={1.41} text={rod.label} value={rod.value}/>}
    {fields.map((r,i)=><PrivateLine key={r.label} position={[(i%2-.5)*.736,firstY-Math.floor(i/2)*.11,0]} width={.68} text={r.label} value={r.value}/>)}
  </group>;
}

const ownerKey=(p:ObservationProps)=>JSON.stringify([p.assetId,p.runtimeId,p.initialPart]);
export const ObservationScreenControls=(p:ObservationProps)=><Screen key={ownerKey(p)} {...p}/>;
export const ObservationHudControls=(p:ObservationProps)=><Hud key={ownerKey(p)} {...p}/>;
