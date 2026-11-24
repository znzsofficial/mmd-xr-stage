import {useLayoutEffect,useRef,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {useStagePlay} from '../play/stagePlay';
import type {PelvicActor} from './Section';
import {useApertureMorph} from './apertureConfig';
import {buttons,field,key,note,percentRange,type Key,type Row} from './controlRows';
import {fitRows,type Fit} from './fitRows';
import {entryClearance} from './solver';
import {prepareFirstStand} from './firstStand';
import {responseRows} from './responseRows';
import {techniquePage} from './techniqueRows';
import {assignPelvic,cancelStrokeDose,canStartAtOpening,clearPelvicFluid,disablePelvic,drainPelvic,enablePelvic,nudgePelvic,patchPelvic,PELVIC_LIMITS as lim,
  releasePelvic,requestPelvicDose,requestStrokeDose,setPelvicCapacity,setPelvicGarmentVisible,startPelvic,stopPelvic,usePelvic,type PelvicMode} from './store';

type Page='use'|'view'|'fit'|'clothes'|'holder'|'fluid'|'technique';
const main=(label:string,press:()=>void,disabled=false)=>buttons(key(label,press,{primary:true,disabled}));
const link=(label:string,press:()=>void)=>buttons(key(label,press));

export type PelvicNavigation={onClothing?:()=>void;cameraKey?:Pick<Key,'label'|'press'>;backLabel?:string};
export function usePelvicControls({assetId,runtimeId}:PelvicActor,source:'screen'|'xr',{onClothing,cameraKey,backLabel}:PelvicNavigation) {
  const zh=useLanguageStore(s=>s.language==='zh'),l=(a:string,b:string)=>zh?a:b;
  const [page,go]=useState<Page>('use'),[fit,setFit]=useState<Fit>('position');
  const pending=useRef<(()=>void)|null>(null);
  useLayoutEffect(()=>()=>{pending.current?.();pending.current=null;},[assetId,runtimeId,source,page]);
  const [listPage,setListPage]=useState(0),[morphPage,setMorphPage]=useState(0);
  const [clothesBack,setClothesBack]=useState<'fit'|'use'>('use');
  const morph=useApertureMorph(assetId),names=useBackpack(s=>s.live[assetId]?.propMorphs);
  const profile=usePelvic(s=>s.byAsset[assetId]);
  const support=usePelvic(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]:undefined);
  const materials=useMmdVrStore(s=>page==='clothes'?s.materialModels[runtimeId]:undefined);
  const selected=useBackpack(s=>s.selected===assetId&&s.live[assetId]?.runtimeId===runtimeId&&s.live[assetId]?.visible&&!s.draft&&!s.busy);
  const blocked=useMmdVrStore(s=>!s.overlayOpen||s.physicsBusy||s.physicsFatal||s.assetLoad.running)||!selected;
  const active=(s:ReturnType<typeof usePelvic.getState>)=>s.active?.assetId===assetId&&s.active.runtimeId===runtimeId?s.active:null;
  const hand=useStagePlay(s=>s.held?.toy==='dildo'?s.held.hand:null);
  const mode=usePelvic(s=>active(s)?.mode),running=usePelvic(s=>!!active(s)?.running);
  const token=usePelvic(s=>active(s)?.token),order=usePelvic(s=>active(s)&&s.strokeOrder);
  const take=usePelvic(s=>active(s)?.take),replaying=take?.kind==='replay';
  const home=usePelvic(s=>page==='technique'&&active(s)?.mode==='standManual'&&!!(s.active?.running?s.sample:s.parkedSample)?.railHome);
  const target=usePelvic(s=>active(s)?.mode==='standManual'?s.active!.position:lim.position[0]);
  const withdrawFirst=usePelvic(s=>active(s)?.mode==='standManual'&&!!s.parkedSample&&s.parkedSample.tip[2]<entryClearance(s.parkedSample.radiusM));
  // The diagram owns continuous samples. Rebuild the controls only when the
  // player's *next action* changes, not on each millimetre of a stroke.
  const signal=usePelvic(s=>{
    const a=active(s);if(!a)return 'none';
    if(a.running&&a.mode==='standAuto'&&page!=='holder')return 'motor'; // Only the independent readout observes crossings.
    if(!s.sample)return s.parkedSample?'parked':'waiting';
    return s.sample.outletInside?'inside':s.sample.outletVisible?'outside':s.sample.exteriorCovered?'coveredOutside':'unverified';
  });
  const stopLabel=take?.kind==='record'?l('停止录制，不保存','Stop without saving'):replaying?l('停止回放','Stop replay'):l('停止','Stop');
  const tabs:Key[]=[],rows:Row[]=[],stop=running||mode&&page==='use'?key(stopLabel,()=>stopPelvic(assetId),{danger:true,disabled:!running}):null;
  const result={title:l('插入','Insertion'),back:backLabel??l('返回互动','Back to interaction'),tabs,rows,stop:mode==='standAuto'&&page==='use'?null:stop,
    status:'',warn:false,live:page==='use',motorReadout:false,chart:page==='view',blocked,enabled:!!profile};
  const modes=[['standManual',l('手动支架','Manual stand')],['standAuto',l('自动支架','Motor stand')]] as const;
  if(!profile){
    result.status=l('成年角色 · 尚未放置支架','Adult character · no stand placed');
    rows.push(buttons(...modes.map(([m,label])=>key(label,()=>{pending.current?.();pending.current=prepareFirstStand(assetId,runtimeId,source,m);}))));
    rows.push(link(l('成年角色入口设置','Adult opening settings'),()=>{if(enablePelvic(assetId,true))go('fit');}));
    if(onClothing)rows.push(link(l('调整服装','Clothing'),onClothing));
    return result;
  }
  const section=page==='holder'||page==='technique'?'use':page==='clothes'?clothesBack:page==='fluid'?'view':page;
  for(const [id,label] of [['use',l('操作','Use')],['view',l('对位与测量','Fit & measure')],['fit',l('调整入口','Fit opening')]] as const)
    tabs.push(key(label,()=>go(id),{id,active:section===id}));
  const known=!!support&&support.kind!=='missing',covered=support?.obstruction;
  const clothes=()=>{
    const all=support?.garmentNames??[],mats=useMmdVrStore.getState().materialModels[runtimeId];
    const selectable=all.filter(n=>mats?.some(m=>m.name===n));
    // Jump to the intersecting layer, but keep row order stable after hiding
    // one. The same spot on the next frame must not hide a different garment.
    const i=support?.blockerName?selectable.indexOf(support.blockerName):-1;
    setClothesBack(page==='fit'?'fit':'use');setListPage(Math.max(0,Math.floor(i/3)));go('clothes');
  }, relocate=()=>{setFit('model');go('fit');};
  const assign=(m:PelvicMode,h?:'left'|'right')=>{if(assignPelvic(assetId,m,source,h))go('use');};
  const start=()=>{
    if(!startPelvic(assetId))return;
    if(mode==='xrManual'){useBackpack.getState().select(null);return;}
  };
  const setTarget=(n:number)=>{const a=active(usePelvic.getState());if(a?.mode==='standManual')nudgePelvic(assetId,n-a.position);};
  const ready=canStartAtOpening(profile,support);
  const jogReady=mode==='standManual'&&!replaying&&(running||ready&&signal==='parked');
  const jog=(n:number)=>{if(running||startPelvic(assetId))setTarget(n);};
  const jogKeys=()=>buttons(key(l('推进','Advance'),()=>jog(running?Math.min(1,target+.25):.5),{primary:true,disabled:!jogReady||(!running&&withdrawFirst)||target>=1}),
    key(l('退回起点','Return to start'),()=>jog(lim.position[0]),{disabled:!jogReady||target<=lim.position[0]&&!withdrawFirst}));
  const targetSlider=()=>field(l('支架目标位置','Target rail position'),Math.round(target*100),'%',[-20,100],5,p=>setTarget(p/100),!running||replaying);
  const site=profile.container==='vaginal'?l('阴道','Vagina'):l('宫腔','Uterus');
  const targetKeys=()=>buttons(key(l('目标：阴道','Target: vagina'),()=>patchPelvic(assetId,{container:'vaginal'}),{active:profile.container==='vaginal'}),
    key(l('目标：宫腔','Target: uterus'),()=>patchPelvic(assetId,{container:'fantasyUterine'}),{active:profile.container==='fantasyUterine'}));
  const insideKeys=()=> ([['vaginal',l('释放到阴道','Release into vagina')],['fantasyUterine',l('释放到宫腔','Release into uterus')]] as const).map(([site,label])=>
    key(label,()=>{if(token===undefined)return;
      if(mode==='standAuto')requestStrokeDose(assetId,token,site);else requestPelvicDose(assetId,site,token);
    },{id:site,primary:true,disabled:!running||(mode==='standAuto'?!ready||!!order:signal!=='inside')}));
  const outsideKey=()=>key(l('体外释放','Release outside'),()=>{if(token!==undefined)requestPelvicDose(assetId,'external',token);},{disabled:!running||!!order||signal!=='outside'});
  const balance=()=>note(`${site}　${profile.fluid[profile.container]} / ${profile.capacity[profile.container]}${profile.overflow?l(` · 已溢出 ${profile.overflow}`,` · Overflow ${profile.overflow}`):''}`);
  const clothesLabel=l('调整服装','Clothing');
  const coverage=covered==='garment'?(support?.blockerName?l(`衣物遮挡：${support.blockerName}`,`Covered by ${support.blockerName}`):l('衣物遮挡入口','Opening covered by clothing')):
    covered?l('入口露出未确认','Exposure unconfirmed'):'';
  const rigName=mode==='xrManual'?(hand==='left'?l('左手持棒','Left hand'):l('右手持棒','Right hand')):
    mode==='standAuto'?l('自动支架','Motor stand'):l('手动支架','Manual stand');
  const waiting=mode==='xrManual'?rigName:signal==='parked'?l('支架已就位','Stand in place'):l('支架就位中','Positioning stand');
  const openFit=()=>{setFit('position');go('fit');};
  const reading=signal==='inside'?l('喷口在阴道内','Outlet inside vagina'):
    signal==='outside'?l('喷口在入口外','Outlet outside'):
    signal==='coveredOutside'?l('喷口在入口外 · 体外释放不可用','Outlet outside · external release unavailable'):
    signal==='unverified'?l('未确认进入','Entry unconfirmed'):l('喷口定位中','Locating outlet');
  if(page==='clothes'){
    result.status=coverage||l('服装显示','Clothing visibility');result.warn=!!covered;
    const candidates=(support?.garmentNames??[]).filter(n=>materials?.some(m=>m.name===n));
    const pages=Math.max(1,Math.ceil(candidates.length/3)),at=Math.min(listPage,pages-1);
    if(!candidates.length)rows.push(note(l('无可单独显示的衣物','No separate clothing layers')));
    for(const n of candidates.slice(at*3,at*3+3)){
      const visible=!!materials?.find(m=>m.name===n)?.visible;
      rows.push(buttons(key(visible?l(`隐藏：${n}`,`Hide: ${n}`):l(`显示：${n}`,`Show: ${n}`),()=>setPelvicGarmentVisible(assetId,n,!visible),{id:n})));
    }
    if(pages>1)rows.push(buttons(key(l('上一页','Previous'),()=>setListPage(at-1),{disabled:!at}),key(l('下一页','Next'),()=>setListPage(at+1),{disabled:at===pages-1})));
    rows.push(link(clothesBack==='fit'?l('返回模型设置','Back to model settings'):l('返回操作','Back to controls'),()=>go(clothesBack)));
  }else if(page==='technique'){
    const withdraw=buttons(key(l('退出到起点','Withdraw to start'),()=>jog(lim.position[0]),{disabled:!jogReady||running&&target<=lim.position[0]}));
    const sheet=techniquePage(assetId,profile,take,l,{manual:mode==='standManual',ready,home,jog:jogKeys(),withdraw,slider:targetSlider(),back:()=>go('use')});
    result.title=l('手法录放','Rail takes');result.status=sheet.status;rows.push(...sheet.rows);
  }else if(page==='holder'){
    result.status=mode?rigName:l('未选择支架或手柄','No stand or controller selected');
    rows.push(...responseRows(assetId,runtimeId,profile,support,l));
    if(mode==='standAuto')rows.push(buttons(outsideKey()));
    if(source==='xr')rows.push(buttons(...(['left','right'] as const).map(h=>key(h==='left'?l('交给左手','Left hand'):l('交给右手','Right hand'),
      ()=>mode==='xrManual'&&h===hand?go('use'):assign('xrManual',h),{active:mode==='xrManual'&&h===hand,disabled:!known}))));
    if(mode)rows.push(link(l('收起假阳具','Put rod away'),()=>{releasePelvic(assetId);go('use');}));
    rows.push(link(l('返回操作','Back to controls'),()=>go('use')));
  }else if(page==='fit'){
    result.status=!known?l('没有找到入口。到「模型」手动指定起点。','Opening not found. Set an origin under Model.'):
       fit==='model'?[profile.showAdapter?l('外阴附件已开启','Vulva attachment on'):l('外阴附件已关闭','Vulva attachment off'),coverage].filter(Boolean).join(' · '):
      l('看角色身上的入口标记调整；改动后需重新确认。','Fit the marker on the actor, then confirm the opening again.');
    rows.push(...fitRows({assetId,runtimeId,source,l,profile,support,fit,setFit,morph,names:names??[],page:morphPage,setPage:setMorphPage,clothes,clear:()=>{disablePelvic(assetId);go('use');}}));
  }else if(page==='fluid'){
    const c=profile.container,uterine=c==='fantasyUterine',amount=profile.fluid[c];
    result.status=`${uterine?l('宫腔','Uterus'):l('阴道','Vagina')} · ${amount} / ${profile.capacity[c]} ${l('单位','units')}`;
    rows.push(targetKeys(),
      note(l('喷口在内时计入所选部位；棒头仍止于宫颈。','An inside release fills the selected site. The rod still stops at the cervix.')),
      field(l('容量','Capacity'),profile.capacity[c],l(' 单位',' units'),lim.capacity,1,n=>setPelvicCapacity(assetId,n)),
      buttons(key(l('排出 1 单位','Drain 1 unit'),()=>drainPelvic(assetId,1),{disabled:!amount}),key(l('清空此处','Empty site'),()=>clearPelvicFluid(assetId),{disabled:!amount,danger:!!amount})),
      link(l('返回测量','Back to measurements'),()=>go('view')));
  }else if(page==='view'){
    result.status=l('入口方向与棒身位置','Opening axis and rod position');
    rows.push(link(l('精液存量与容量','Semen amount and capacity'),()=>go('fluid')));
    if(!mode)rows.push(link(l('去放置假阳具','Place the rod'),()=>go('use')));
  }else{
    if(known)rows.push(buttons(...modes.map(([m,label])=>key(label,()=>{if(mode!==m&&!active(usePelvic.getState())?.running)assign(m);},{active:mode===m,disabled:running&&mode!==m}))));
    if(!support){result.status=l('入口定位中','Locating opening');}
    else if(!known){result.warn=true;result.status=l('未找到入口','Opening not found');rows.push(main(l('手动定位入口','Locate opening manually'),relocate));}
    else if(!mode){
      result.status=l('尚未放置支架','No stand placed');
    }else if(!running&&mode!=='xrManual'&&signal==='waiting'){
      result.status=waiting;
    }else if(!running&&!ready){
      result.status=(mode==='xrManual'?'':l('支架已就位 · ','Stand in place · '))+(coverage||l('入口露出未确认','Exposure unconfirmed'));
      rows.push(main(l('保持穿衣继续','Continue clothed'),()=>patchPelvic(assetId,{clothed:true})));
      if(!covered)rows.push(link(l('确认入口露出','Confirm exposure'),()=>patchPelvic(assetId,{clothingClear:true})));
      else if(!onClothing)rows.push(link(l('重调入口位置','Refit opening'),openFit));
    }else{
      const idle=withdrawFirst?l('已停止 · 待退回起点','Stopped · return pending'):
        mode==='standManual'?l('支架静止 · 入口外','Stand at rest · outside'):
        mode==='xrManual'?l('手持模式 · 侧握释放','Hand control · grip to release'):l('支架静止','Stand at rest');
      result.status=`${profile.clothed?l('穿衣互动 · ','Clothed · '):''}${running?reading:signal==='waiting'&&mode!=='xrManual'?waiting:idle}`;
      if(mode==='xrManual'&&!running)rows.push(main(l('开始手持并收起面板','Start hand control'),start));
    }
    if(mode==='standAuto'&&(ready||running)){
      result.motorReadout=true;
      const motor=key(running?l('停止往复','Stop motor'):l('开始往复','Start motor'),()=>{
        const a=active(usePelvic.getState());if(a?.mode!=='standAuto'||a.token!==token||a.running!==running)return;
        if(running)stopPelvic(assetId);else startPelvic(assetId);
      },{id:'motor-power',pressToken:token,stop:running,primary:!running,disabled:!running&&(!ready||signal!=='parked')});
      rows.push(buttons(motor,key(l('取消释放','Cancel release'),()=>{if(order)cancelStrokeDose(order.id);},{id:'cancel-dose',pressToken:order?.id,disabled:!order})),
        buttons(...insideKeys()),{kind:'strokeReading'},
        {kind:'fieldPair',fields:[field(l('每秒往复','Cycles per second'),profile.speedHz,' Hz',lim.speedHz,.1,n=>patchPelvic(assetId,{speedHz:n})),
          field(l('最深位置','Maximum depth'),Math.round(profile.stroke*100),'%',percentRange(lim.stroke),5,n=>patchPelvic(assetId,{stroke:n/100}))]},
        {kind:'depthReading'});
    }else if(mode&&(running||ready)){
      if(mode==='standManual'&&!replaying)rows.push(jogKeys());
      rows.push(balance(),mode==='xrManual'?targetKeys():buttons(...insideKeys(),outsideKey()));
      if(mode==='standManual')rows.push(field(l('目标深度','Target depth'),Math.max(0,Math.round(target*100)),'%',[0,100],5,n=>jog(n/100),!jogReady||!running&&withdrawFirst));
      rows.push({kind:'depthReading'});
    }
    rows.push(buttons(key(clothesLabel,onClothing??clothes),...(cameraKey?[{...cameraKey,id:'actor-camera'}]:[])));
    const takes=!!profile.technique||mode==='standManual'&&ready;
    if(known||takes)rows.push(buttons(...(known?[key(l('更多操作','More controls'),()=>go('holder'))]:[]),
      ...(takes?[key(l('手法录放','Rail takes'),()=>go('technique'))]:[])));
  }
  return result;
}
