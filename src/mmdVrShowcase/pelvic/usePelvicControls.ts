import { useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import { useStagePlay } from '../play/stagePlay';
import type { PelvicActor } from './Section';
import { defaultPelvicCalibration, type PelvicCalibration } from './contract';
import { setApertureMorph, useApertureMorph } from './apertureConfig';
import { assignPelvic, clearPelvicFluid, disablePelvic, drainPelvic, enablePelvic, nudgePelvic, patchPelvic, PELVIC_LIMITS as lim,
  releasePelvic, requestPelvicDose, setPelvicCapacity, startPelvic, stopPelvic, usePelvic, type PelvicMode } from './store';

type Tab='tool'|'fit'|'fluid';
type Fit='offset'|'rotation'|'size'|'anchor'|'morph';
type Source='screen'|'xr';
export type Key = { label:string; press:()=>void; id?:string; active?:boolean; disabled?:boolean; danger?:boolean };
export type Row = {kind:'buttons';keys:Key[]}|{kind:'note';text:string;warn?:boolean}|
  {kind:'choose';label:string;names:readonly string[];chosen:string|null;none:string;pick:(name:string|null)=>void}|
  {kind:'field';label:string;value:number;unit:string;range:readonly [number,number];step:number;change:(n:number)=>void;disabled:boolean};
const buttons=(...keys:Key[]):Row=>({kind:'buttons',keys});
const note=(text:string,warn=false):Row=>({kind:'note',text,warn});
const key=(label:string,press:()=>void,options:Partial<Omit<Key,'label'|'press'>>={}):Key=>({label,press,...options});
const field=(label:string,value:number,unit:string,range:readonly [number,number],step:number,change:(n:number)=>void,disabled=false):Row=>
  ({kind:'field',label,value,unit,range,step,change,disabled});
const cmRange=([a,b]:readonly [number,number])=>[a*100,b*100] as const;

export function usePelvicControls({assetId,runtimeId}:PelvicActor,source:Source) {
  const zh=useLanguageStore(s=>s.language==='zh'),l=(a:string,b:string)=>zh?a:b;
  const [tab,setTab]=useState<Tab>('tool'),[fit,setFit]=useState<Fit>('offset');
  const [morphPage,setMorphPage]=useState(0),morph=useApertureMorph(assetId);
  const names=useBackpack(s=>s.live[assetId]?.propMorphs);
  const profile=usePelvic(s=>s.byAsset[assetId]);
  const support=usePelvic(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]:undefined);
  const selected=useBackpack(s=>s.selected===assetId&&s.live[assetId]?.runtimeId===runtimeId&&s.live[assetId]?.visible&&!s.draft&&!s.busy);
  const blocked=useMmdVrStore(s=>!s.overlayOpen||s.physicsBusy||s.physicsFatal||s.assetLoad.running)||!selected;
  const hand=useStagePlay(s=>s.held?.toy==='dildo'?s.held.hand:null);
  // Automatic rail samples redraw only the chart. They never invalidate the
  // editable fields or produce new text textures in the rest of the HUD.
  const mode=usePelvic(s=>s.active?.assetId===assetId&&s.active.runtimeId===runtimeId?s.active.mode:null);
  const running=usePelvic(s=>s.active?.assetId===assetId&&s.active.running);
  const manualPosition=usePelvic(s=>s.active?.assetId===assetId&&s.active.mode==='standManual'?s.active.position:lim.position[0]);
  const hasSample=usePelvic(s=>s.active?.assetId===assetId&&!!s.sample);
  const title=l('骨盆附件','Pelvic attachment'), back=l('返回','Back');
  const tabs:Key[]=[],rows:Row[]=[],notes:Row[]=[];
  const result={title,back,tabs,rows,notes,enabled:!!profile,blocked};
  if(!profile){
    rows.push(note(l('开启后可为此角色校准入口、操作硅胶件并查看剖面。','Enable the attachment for this actor to calibrate the opening, operate the rod and view its section.')),
      buttons(key(l('为此成年角色启用','Enable for this adult'),()=>enablePelvic(assetId,true))));
    return result;
  }
  const toFit=(sub:Fit)=>{setFit(sub);setTab('fit');};
  const canAssign=!!support&&support.kind!=='missing';
  const cal=profile.calibration, patchCal=(calibration:Partial<PelvicCalibration>)=>patchPelvic(assetId,{calibration});
  const obstruction=support?.obstruction;
  const sourceText=!support?l('正在读取角色锚点','Checking actor anchor'):
    support.kind==='missing'?l('缺少骨骼锚点，请手动定位。','No bone anchor. Set a manual origin.'):
    `${support.kind==='bones'?l('骨骼锚点','Bone anchor'):l('手动锚点','Manual anchor')}${support.anchorName?` · ${support.anchorName}`:''}`;
  notes.push(note(sourceText,!canAssign));
  if(obstruction)notes.push(note(obstruction==='garment'?l('衣物遮住入口。隐藏或移开衣物后重试。','Clothing covers the opening. Hide or move it before starting.'):
    l('无法验证遮挡。请隐藏相关衣物材质，再重试。','Coverage is unresolved. Hide the relevant clothing material and retry.'),true));
  tabs.push(...(['tool','fit','fluid'] as const).map((t,i)=>key([l('道具','Rod'),l('校准','Fit'),l('液量','Fluid')][i],()=>setTab(t),{active:tab===t})));
  function assign(m:PelvicMode,label:string,h?:'left'|'right'){
    const current=mode===m&&(!h||hand===h);
    return key(label,()=>{if(!current)assignPelvic(assetId,m,source,h);},{active:current,disabled:!canAssign});
  }
  if(mode){
    const start=()=>{if(startPelvic(assetId)&&mode==='xrManual')useBackpack.getState().select(null);};
    notes.push(buttons(key(mode==='xrManual'?l('启动并收起面板','Start & close panel'):l('启动','Start'),start,{disabled:running||!profile.clothingClear||!canAssign||!!obstruction}),
      key(l('停机','Stop'),()=>stopPelvic(assetId),{disabled:!running,danger:running})),
      buttons(key(l('卸下硅胶件','Remove rod'),()=>releasePelvic(assetId))));
  }
  const garment=key(profile.clothingClear?l('已确认入口露出','Opening confirmed clear'):l('确认入口已露出','Confirm opening is clear'),()=>patchPelvic(assetId,{clothingClear:!profile.clothingClear}),{id:'garment',active:profile.clothingClear});
  if(tab==='tool'){
    if(!canAssign)rows.push(buttons(key(l('设置锚点','Set anchor'),()=>toFit('anchor'))));
    rows.push(buttons(assign('standManual',l('装到手动滑轨','Mount on slider')),assign('standAuto',l('装到自动支架','Mount on motor'))));
    if(source==='xr')rows.push(buttons(assign('xrManual',l('交给左手','Give to left hand'),'left'),assign('xrManual',l('交给右手','Give to right hand'),'right')));
    if(!profile.clothingClear){
      rows.push(note(l('请确认入口已露出且校准正确。合并材质或未知衣物须手动核实。附件不会打开 PMX 表面。',
        'Verify the opening is exposed and calibrated. Check merged or unknown clothing yourself. The attachment does not open the PMX surface.')));
    }
    rows.push(buttons(garment));
    if(mode==='standManual'){
      rows.push(field(l('滑轨指令','Slider command'),manualPosition*100,'%',[-20,100],5,p=>{
        const a=usePelvic.getState().active;if(a?.assetId===assetId&&a.mode==='standManual')nudgePelvic(assetId,p/100-a.position);
      },!running),note(l('0% 为入口，100% 为滑轨限位。实际深度见剖面。','0% is the opening; 100% is the rail limit. See the section for measured depth.')));
    }else if(mode==='standAuto'){
      rows.push(field(l('往复频率','Cycle rate'),profile.speedHz,' Hz',lim.speedHz,.1,n=>patchPelvic(assetId,{speedHz:n})),
        field(l('支架行程上限','Stroke limit'),profile.stroke*100,'%',cmRange(lim.stroke),5,n=>patchPelvic(assetId,{stroke:n/100})),
        note(l('行程为滑轨指令；1 Hz 表示每秒往返一次。','Stroke is a rail command. 1 Hz is one round trip per second.')));
    }else if(mode==='xrManual')rows.push(note(l('启动后收起面板。移动持棒手控制杆身，按握键释放一剂；剖面留在角色旁。','Start to close the panel. Move the holding hand to guide the rod. Squeeze the grip for one dose; the section stays beside the actor.')));
  }else if(tab==='fit'){
    rows.push(buttons(...(['offset','rotation','size','anchor'] as const).map((k,i)=>key([l('位置','Offset'),l('方向','Angle'),l('尺寸','Size'),l('适配','Rig')][i],()=>setFit(k),{active:k===fit||(k==='anchor'&&fit==='morph')}))));
    if(fit==='offset'){
      for(const [i,label] of [l('X · 左右','X · lateral'),l('Y · 高低','Y · vertical'),l('Z · 里外','Z · outward')].entries())rows.push(
        field(label,cal.offsetM[i]*100,' cm',cmRange(lim.offsetM),.5,n=>{
          const xyz:[number,number,number]=[...cal.offsetM];xyz[i]=n/100;patchCal({offsetM:xyz});
        }));
      rows.push(note(l('参考厘米随角色缩放；调整时道具会停机。','Reference cm scale with the actor. Changing fit stops the rod.')));
    }else if(fit==='rotation')rows.push(field(l('俯仰','Pitch'),cal.pitchDeg,'°',lim.pitchDeg,1,n=>patchCal({pitchDeg:n})),
      field(l('偏航','Yaw'),cal.yawDeg,'°',lim.yawDeg,1,n=>patchCal({yawDeg:n})),note(l('俯仰为正时，向内的轴抬高。','Positive pitch raises the inward axis.')));
    else if(fit==='size')rows.push(field(l('通道长度','Canal length'),cal.lengthM*100,' cm',cmRange(lim.lengthM),.1,n=>patchCal({lengthM:n/100})),
      field(l('入口半径','Opening radius'),cal.radiusM*100,' cm',cmRange(lim.radiusM),.1,n=>patchCal({radiusM:n/100})),
      note(l('这里是附件参考尺寸；剖面的深度是舞台实测厘米。','Reference dimensions scale with the actor. Section depth is in measured stage centimetres.')));
    else if(fit==='anchor'){
      rows.push(buttons(key(l('显示独立开口附件（适配模型）','Show separate opening on fitted model'),()=>patchPelvic(assetId,{showAdapter:!profile.showAdapter}),{active:profile.showAdapter})),
        buttons(key(l('映射开合形态','Map opening morph'),()=>{setMorphPage(Math.max(0,Math.floor((names?.indexOf(morph??'')??0)/3)));setFit('morph');})),
        note(l('手动起点仅根据模型外形估算。请用位置、方向与尺寸对准此角色。','A manual origin is estimated from the model bounds. Adjust offset, angle and size to fit this actor.')),
        buttons(key(l('以模型估算点手动注册','Use model estimate as origin'),()=>{if(support?.manualSeed){patchCal({manual:support.manualSeed});setFit('offset');}},{disabled:!support?.manualSeed})),
        buttons(key(l('恢复骨骼注册','Use bone registration'),()=>patchCal({manual:null}),{disabled:!cal.manual})),
        buttons(key(l('还原尺寸、角度与偏移','Reset fit dimensions & pose'),()=>patchCal({...defaultPelvicCalibration,manual:cal.manual}))),
        buttons(key(l('关闭并清除本角色附件','Disable & clear actor data'),()=>{disablePelvic(assetId);setTab('tool');},{danger:true})));
    }else{
      const none=l('不映射','No mapping'), label=l('开合形态','Opening morph');
      const pick=(name:string|null)=>setApertureMorph(assetId,name);
      rows.push(note(l('仅映射作者为入口开合制作的形态。选择“不映射”仍可使用剖面。','Map only a morph authored for the opening. The section also works without a mapping.')));
      if(!names?.length)rows.push(note(l('此模型无可选形态。','No available morphs on this model.')));
      if(morph&&!names?.includes(morph))rows.push(note(l('之前的映射已不可用。','Previous mapping is unavailable.'),true));
      if(source==='screen')rows.push({kind:'choose',label,names:names??[],chosen:morph,none,pick});
      else{
        const pages=Math.max(1,Math.ceil((names?.length??0)/3)),page=Math.min(morphPage,pages-1);
        rows.push(note(`${label} · ${morph??none}`),buttons(key(none,()=>pick(null),{active:!morph})),
          ...(names??[]).slice(page*3,page*3+3).map(n=>buttons(key(n,()=>pick(n),{active:morph===n}))));
        if(pages>1)rows.push(buttons(key(l('上一页','Prev'),()=>setMorphPage(page-1),{disabled:!page}),
          key(`${page+1} / ${pages}`,()=>{}, {disabled:true}),key(l('下一页','Next'),()=>setMorphPage(page+1),{disabled:page>=pages-1})));
      }
    }
  }else{
    const c=profile.container, fantasy=c==='fantasyUterine', empty=profile.fluid[c]<=0;
    rows.push(buttons(key(l('阴道容器','Vaginal'),()=>patchPelvic(assetId,{container:'vaginal'}),{active:!fantasy}),
      key(l('虚构宫腔','Fantasy uterus'),()=>patchPelvic(assetId,{container:'fantasyUterine'}),{active:fantasy})),
      note(fantasy?l('宫腔储液为虚构玩法；道具仍限位在宫颈。','Uterine storage is fictional. The physical rod still stops at the cervix.'):
        l('喷口在内时计入此容器，在外且可见时外喷；位置未验证时不释放。','An inside outlet fills this container. A visible outside outlet sprays out. An unverified position releases nothing.')),
      field(l('游戏容量','Game capacity'),profile.capacity[c],l(' 单位',' u.'),lim.capacity,1,n=>setPelvicCapacity(assetId,n)),
      buttons(key(l('释放 1 剂','Release 1 dose'),()=>requestPelvicDose(assetId),{disabled:!mode||!running||!hasSample||mode==='xrManual'})),
      buttons(key(l('排出 1 单位','Drain 1 unit'),()=>drainPelvic(assetId,1),{disabled:empty}),
        key(l('清空此容器','Empty container'),()=>clearPelvicFluid(assetId),{disabled:empty,danger:!empty})),
      note(l('每剂 1 游戏单位。喷口未确认或越限时，本次指令作废，不补喷。清空保留累计量；切换容器不转移液体。','One dose is one game unit. Unverified or past the stop: the command is spent without a later spray. Emptying keeps totals; switching containers keeps both balances.')));
  }
  return result;
}
