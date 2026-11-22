import {useLayoutEffect,useRef,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {ObservationDiagram} from './ObservationDiagram';
import {setBreastView,useBreastView} from '../bodyState/breast/view';
import {BODY_DAY_SECONDS,sampleBody} from '../bodyState/data';
import {useBodyState} from '../bodyState/store';
import {actorBinding,actorRodSample,type ObservationAtlasPart} from '../pelvic/atlas/painter';
import {atlasAngles,setAtlasView,useAtlasView} from '../pelvic/atlas/view';
import {PrivateButton,PrivateLine,PrivateSheet,PrivateSlider} from '../pelvic/HudPrivateControls';
import {outletLabel} from '../pelvic/sectionProjection';
import {usePelvic} from '../pelvic/store';
import {foldStyles} from '../pelvic/vulvaForm';
import '../pelvic/controls.css';
import './observation.css';

export type ObservationPart='breast'|ObservationAtlasPart;
export type ObservationProps={assetId:string;runtimeId:string;onBack:()=>void;initialPart?:ObservationPart;backLabel?:string};
const parts=['breast','vulva','vagina','uterus'] as const;
const presets=['front','oblique','side'] as const;
const words={
  zh:{title:'身体观察',back:'返回角色',breast:'乳房',vulva:'外阴',vagina:'阴道',uterus:'子宫',part:'观察部位',angle:'观察角度',front:'正面',oblique:'斜面',side:'侧面',
    freeze:'定格图像',play:'播放图像',drag:'横拖图面旋转',labels:'结构标注',cut:'剖面',source:'身体状态',standard:'默认示意',preview:'当前预览',saved:'角色设定',day:'周期日',
    fullness:'饱满度',milk:'存量（左 / 右）',rod:'杆位',none:'无杆位采样',depth:'在内深度',vaginal:'阴道精液',uterine:'宫腔精液',unit:'游戏单位',lining:'内膜'},
  en:{title:'Body observation',back:'Back to actor',breast:'Breast',vulva:'Vulva',vagina:'Vagina',uterus:'Uterus',part:'Body part',angle:'View angle',front:'Front',oblique:'Oblique',side:'Side',
    freeze:'Freeze figure',play:'Animate figure',drag:'Drag across the figure to rotate',labels:'Labels',cut:'Cutaway',source:'Body state',standard:'Default study',preview:'Current preview',saved:'Actor settings',day:'Cycle day',
    fullness:'Fullness',milk:'Stored (L / R)',rod:'Rod',none:'No rod sample',depth:'Inside depth',vaginal:'Vaginal semen',uterine:'Uterine semen',unit:'game u.',lining:'Lining'},
};
function useView({assetId,initialPart='breast'}:ObservationProps){
  const [part,choose]=useState(initialPart);
  const zh=useLanguageStore(s=>s.language==='zh'),t=zh?words.zh:words.en;
  const chest=useBreastView(assetId),atlas=useAtlasView(assetId),breast=part==='breast';
  const view=breast?chest:atlas;
  const set=breast?setBreastView:setAtlasView;
  const {degrees,motion}=view;
  const foldNames=zh?{natural:'自然',soft:'柔和',defined:'层次'}:{natural:'Natural',soft:'Soft',defined:'Defined'};
  return {part,choose,t,zh,degrees,motion,turn:(degrees:number)=>set(assetId,{degrees}),
    transport:{label:motion?t.freeze:t.play,active:!motion,press:()=>set(assetId,{motion:!motion})},
    shapes:part==='vulva'?foldStyles.map(f=>({label:foldNames[f],active:f===atlas.foldStyle,press:()=>setAtlasView(assetId,{foldStyle:f})})):[],
    options:[...(breast?[{label:t.cut,active:chest.section,press:()=>setBreastView(assetId,{section:!chest.section})}]:[]),
      ...(part==='uterus'||breast&&chest.section?[{label:t.labels,active:view.labels,press:()=>set(assetId,{labels:!view.labels})}]:[])],
  };
}
const percent=(n:number)=>`${Math.round(n*100)}%`;
function useReadings(assetId:string,runtimeId:string,{part,zh,t}:ReturnType<typeof useView>){
  const saved=useBodyState(s=>s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId]);
  const draft=useBodyState(s=>s.draft?.assetId===assetId),daily=saved&&sampleBody(saved);
  const pelvic=part!=='breast',p=usePelvic(s=>pelvic?s.byAsset[assetId]:undefined);
  const rod=usePelvic(s=>p?actorRodSample(s,assetId,runtimeId):null);
  const running=usePelvic(s=>!!p&&actorBinding(s,assetId,runtimeId)?.running===true);
  const lines=[{label:t.source,value:saved?(draft?t.preview:t.saved):t.standard}];
  if(saved&&daily){
    lines.push({label:t.day,value:`${+(saved.day+saved.daySeconds/BODY_DAY_SECONDS).toFixed(1)} / ${saved.length}`});
    if(part==='uterus')lines.push({label:t.lining,value:percent(daily.lining)});
    if(!pelvic){lines.push({label:t.fullness,value:percent(daily.fullness)});
      if(saved.lactating)lines.push({label:t.milk,value:`${percent(saved.left)} / ${percent(saved.right)}`});}
  }
  if(pelvic){lines.push({label:t.rod,value:rod?outletLabel(rod,zh,!running):t.none});
    if(running&&rod?.outletInside)lines.push({label:t.depth,value:`${(rod.depth*100).toFixed(1)} cm`});
    if(p&&part!=='vulva'){
      const k=part==='vagina'?'vaginal':'fantasyUterine';
      lines.push({label:k==='vaginal'?t.vaginal:t.uterine,value:`${+p.fluid[k].toFixed(2)} / ${+p.capacity[k].toFixed(2)} ${t.unit}`});
    }
  }
  return lines;
}

function Screen(props:ObservationProps){
  const {assetId,runtimeId,onBack,backLabel}=props,actor={assetId,runtimeId};
  const view=useView(props),{t,part,degrees,turn}=view,readings=useReadings(assetId,runtimeId,view);
  const sheet=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const sidebar=sheet.current?.closest('.screen-library');if(sidebar)sidebar.scrollTop=0;},[]);
  return <div ref={sheet} className="pelvic-screen actor-observation" role="group" aria-label={t.title}>
    <div className="observation-navigation">
      <header className="pelvic-heading"><h3>{t.title}</h3><button type="button" className="pelvic-key pelvic-back" onClick={onBack}>{backLabel??t.back}</button></header>
      <div className="pelvic-nav"><div className="pelvic-keys" role="group" aria-label={t.part}>{parts.map(k=><button className="pelvic-key" type="button" key={k} aria-pressed={part===k} onClick={()=>view.choose(k)}>{t[k]}</button>)}</div></div>
      <div className="pelvic-keys observation-presets" role="group" aria-label={t.angle}>{presets.map(k=><button className="pelvic-key" type="button" key={k} aria-pressed={degrees===atlasAngles[k]} onClick={()=>turn(atlasAngles[k])}>{t[k]}</button>)}</div>
    </div>
    <figure><ObservationDiagram key={part} {...actor} part={part} loading={view.zh?'正在绘制图像…':'Drawing figure…'}/>
      <figcaption>{t.drag}<output aria-label={t.angle}>{degrees}°</output></figcaption></figure>
    <div className="pelvic-keys">{[view.transport,...view.options].map(a=><button type="button" className="pelvic-key" key={a===view.transport?'transport':a.label} aria-pressed={a.active} onClick={a.press}>{a.label}</button>)}</div>
    {view.shapes.length>0&&<div role="group" aria-label={view.zh?'外阴外形':'Fold shape'} className="pelvic-keys observation-presets">{view.shapes.map(s=><button type="button" key={s.label} className="pelvic-key" aria-pressed={s.active} onClick={s.press}>{s.label}</button>)}</div>}
    <dl>{readings.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
  </div>;
}

function Hud(props:ObservationProps){
  const {assetId,runtimeId,onBack,backLabel}=props,actor={assetId,runtimeId};
  const view=useView(props),{t,part,degrees,turn}=view,readings=useReadings(assetId,runtimeId,view);
  // Back, part and angle targets stay at fixed coordinates across every view.
  // Only the measure list changes height when there's a real incoming sample.
  const left=-.284,art=.86,right=.452,rail=.506;
  // The actor anchor can sit near either edge of the forward view. Keep the
  // sheet close to the width of the actor menu; long rod verdicts get a full
  // line under the figure, not a narrow rail at the outside edge of one eye.
  const rod=readings.find(r=>r.label===t.rod),fields=readings.filter(r=>r!==rod);
  const rodY=part==='vulva'?-.67:-.592,firstY=rod?rodY-.104:-.592,bottom=firstY-Math.floor((fields.length-1)/2)*.11-.08;
  return <group name="observation:controls" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <group position-y={(.69+bottom)/2}><PrivateSheet size={[1.51,.69-bottom]}/></group>
    <PrivateLine position={[-.265,.586,0]} width={.90} title text={t.title}/>
    <PrivateButton position={[right,.586,0]} size={[rail,.14]} label={backLabel??t.back} variant="quiet" onPress={onBack}/>
    {parts.map((k,i)=><PrivateButton key={k} position={[(i-1.5)*.363,.408,0]} size={[.34,.145]} label={t[k]} active={part===k} variant="tab" onPress={()=>view.choose(k)}/>)}
    {presets.map((k,i)=><PrivateButton key={k} position={[left+(i-1)*.295,.222,0]} size={[.273,.142]} label={t[k]} active={degrees===atlasAngles[k]} onPress={()=>turn(atlasAngles[k])}/>)}
    <PrivateButton position={[right,.222,0]} size={[rail,.142]} label={view.transport.label} active={view.transport.active} onPress={view.transport.press}/>
    <group position={[left,-.194,0]}><ObservationDiagram key={part} {...actor} part={part} widthM={art} loading={view.zh?'正在绘制图像…':'Drawing figure…'}/></group>
    <PrivateLine position={[right,.04,0]} width={rail} text={t.angle} value={`${degrees}°`}/>
    <PrivateSlider position={[right,-.088,0]} width={rail} disabled={false} value={(degrees+90)/180} onChange={v=>turn(v*180-90)}/>
    {view.options.map((a,i)=><PrivateButton key={a.label} position={[right,-.26-i*.17,0]} size={[rail,.14]} label={a.label} active={a.active} onPress={a.press}/>)}
    {view.shapes.map((a,i)=><PrivateButton key={a.label} position={[right,-.22-i*.15,0]} size={[rail,.135]} label={a.label} active={a.active} onPress={a.press}/>)}
    {rod&&<PrivateLine position={[0,rodY,0]} width={1.41} text={rod.label} value={rod.value}/>}
    {fields.map((r,i)=><PrivateLine key={r.label} position={[(i%2-.5)*.736,firstY-Math.floor(i/2)*.11,0]} width={.68} text={r.label} value={r.value}/>)}
  </group>;
}

const ownerKey=(p:ObservationProps)=>JSON.stringify([p.assetId,p.runtimeId,p.initialPart]);
export const ObservationScreenControls=(p:ObservationProps)=><Screen key={ownerKey(p)} {...p}/>;
export const ObservationHudControls=(p:ObservationProps)=><Hud key={ownerKey(p)} {...p}/>;
