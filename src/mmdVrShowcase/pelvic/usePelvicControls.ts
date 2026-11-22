import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {useStagePlay} from '../play/stagePlay';
import type {PelvicActor} from './Section';
import {useApertureMorph} from './apertureConfig';
import {buttons,field,key,note,percentRange,type Key,type Row} from './controlRows';
import {fitRows,type Fit} from './fitRows';
import {entryClearance} from './solver';
import {assignPelvic,clearPelvicFluid,disablePelvic,drainPelvic,enablePelvic,nudgePelvic,patchPelvic,PELVIC_LIMITS as lim,
  releasePelvic,requestPelvicDose,setPelvicCapacity,setPelvicGarmentVisible,startPelvic,stopPelvic,usePelvic,type PelvicMode} from './store';

type Page='use'|'view'|'fit'|'clothes'|'holder'|'fluid';
const main=(label:string,press:()=>void,disabled=false)=>buttons(key(label,press,{primary:true,disabled}));
const link=(label:string,press:()=>void)=>buttons(key(label,press));

export function usePelvicControls({assetId,runtimeId}:PelvicActor,source:'screen'|'xr') {
  const zh=useLanguageStore(s=>s.language==='zh'),l=(a:string,b:string)=>zh?a:b;
  const [page,go]=useState<Page>('use'),[fit,setFit]=useState<Fit>('position');
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
  const target=usePelvic(s=>active(s)?.mode==='standManual'?s.active!.position:lim.position[0]);
  const withdrawFirst=usePelvic(s=>active(s)?.mode==='standManual'&&!!s.parkedSample&&s.parkedSample.tip[2]<entryClearance(s.parkedSample.radiusM));
  // The diagram owns continuous samples. Rebuild the controls only when the
  // player's *next action* changes, not on each millimetre of a stroke.
  const signal=usePelvic(s=>{
    if(!active(s))return 'none';
    if(!s.sample)return s.parkedSample?'parked':'waiting';
    return s.sample.outletInside?'inside':s.sample.outletVisible?'outside':'unverified';
  });
  const tabs:Key[]=[],rows:Row[]=[],stop=running?key(l('停止','Stop'),()=>stopPelvic(assetId),{danger:true}):null;
  const result={title:l('骨盆附件','Pelvic attachment'),back:l('返回角色','Back to actor'),tabs,rows,stop,
    status:'',warn:false,chart:page==='view',blocked,enabled:!!profile};
  if(!profile){
    result.status=l('此角色还没有启用骨盆附件。','The attachment is off for this actor.');
    rows.push(main(l('为此成年角色启用','Enable for this adult'),()=>enablePelvic(assetId,true)));
    return result;
  }
  const section=page==='holder'?'use':page==='clothes'?clothesBack:page==='fluid'?'view':page;
  for(const [id,label] of [['use',l('操作','Use')],['view',l('观察图','Anatomy')],['fit',l('调整入口','Fit opening')]] as const)
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
    // It is the physical rail that crosses the opening in later frames. A
    // restart from a stopped interior pose first withdraws to re-arm outside.
    if(mode==='standManual')nudgePelvic(assetId,(withdrawFirst?lim.position[0]:.5)-target);
  };
  const setTarget=(n:number)=>{const a=active(usePelvic.getState());if(a?.mode==='standManual')nudgePelvic(assetId,n-a.position);};
  const jog=()=>buttons(key(l('退到入口外','Withdraw'),()=>setTarget(lim.position[0]),{disabled:target<=lim.position[0]}),
    key(l('向内推一段','Advance'),()=>setTarget(Math.min(1,target+.25)),{disabled:target>=1}));
  const dose=()=>buttons(key(l('射出精液','Release semen'),()=>requestPelvicDose(assetId),{disabled:signal!=='inside'&&signal!=='outside'}));
  const site=profile.container==='vaginal'?l('阴道','Vagina'):l('宫腔','Uterus');
  const balance=()=>note(`${site} ${profile.fluid[profile.container]} / ${profile.capacity[profile.container]}${profile.overflow?l(` · 已溢出 ${profile.overflow}`,` · Overflow ${profile.overflow}`):''}`);
  const clothesLabel=l('调整衣物','Manage clothing');
  const coverage=covered==='garment'?(support?.blockerName?l(`「${support.blockerName}」挡住了入口。`,`The opening is covered by ${support.blockerName}.`):l('衣物挡住了入口。','Clothing covers the opening.')):
    covered?l('还没看清入口。可暂停动作，或调整衣物。','The opening is not verified. Pause the motion or check clothing.'):'';
  const rigName=mode==='xrManual'?(hand==='left'?l('左手持棒','Left hand'):l('右手持棒','Right hand')):
    mode==='standAuto'?l('自动支架','Motor stand'):l('手动支架','Manual stand');
  const waiting=mode==='xrManual'?l('已交给手柄。','The rod is in your hand.'):
    signal==='parked'?l('支架已摆好，棒身静止。','Stand in place. The rod is stationary.'):
    l('正在摆放支架…','Placing the stand…');
  const openFit=()=>{setFit('position');go('fit');};
  if(page==='clothes'){
    result.status=coverage||l('点衣物名称可隐藏或重新显示。','Hide or show a clothing material.');result.warn=!!covered;
    const candidates=(support?.garmentNames??[]).filter(n=>materials?.some(m=>m.name===n));
    const pages=Math.max(1,Math.ceil(candidates.length/3)),at=Math.min(listPage,pages-1);
    if(!candidates.length)rows.push(note(l('没有可单独开关的衣物材质。可换姿势，或使用衣物分层的模型。','No separate clothing material is available. Change pose or use a model with separate clothing.')));
    for(const n of candidates.slice(at*3,at*3+3)){
      const visible=!!materials?.find(m=>m.name===n)?.visible;
      rows.push(buttons(key(visible?l(`隐藏：${n}`,`Hide: ${n}`):l(`显示：${n}`,`Show: ${n}`),()=>setPelvicGarmentVisible(assetId,n,!visible),{id:n})));
    }
    if(pages>1)rows.push(buttons(key(l('上一页','Previous'),()=>setListPage(at-1),{disabled:!at}),key(l('下一页','Next'),()=>setListPage(at+1),{disabled:at===pages-1})));
    rows.push(link(clothesBack==='fit'?l('返回模型设置','Back to model settings'):l('返回操作','Back to controls'),()=>go(clothesBack)));
  }else if(page==='holder'){
    result.status=mode?l(`当前：${rigName}`,`Using: ${rigName}`):l('选择谁来拿假阳具。','Choose how to hold the rod.');
    for(const [m,label,h] of [['standManual',l('手动支架','Manual stand')],['standAuto',l('自动支架','Motor stand')],
      ...(source==='xr'?[['xrManual',l('交给左手','Left hand'),'left'],['xrManual',l('交给右手','Right hand'),'right']] as const:[])] as const){
      const current=mode===m&&(!h||h===hand);
      rows.push(buttons(key(label,()=>current?go('use'):assign(m,h),{active:current,disabled:!known})));
    }
    if(mode)rows.push(link(l('收起假阳具','Put rod away'),()=>{releasePelvic(assetId);go('use');}));
  }else if(page==='fit'){
    result.status=!known?l('没有找到入口。到「模型」手动指定起点。','Opening not found. Set an origin under Model.'):
      fit==='model'?coverage||l('可单独看角色的外阴附件，不用放置道具。','You can inspect the attachment without placing a rod.'):
      l('看角色身上的入口标记调整；改动后需重新确认。','Fit the marker on the actor, then confirm the opening again.');
    rows.push(...fitRows({assetId,source,l,profile,support,fit,setFit,morph,names:names??[],page:morphPage,setPage:setMorphPage,clothes,clear:()=>{disablePelvic(assetId);go('use');}}));
  }else if(page==='fluid'){
    const c=profile.container,uterine=c==='fantasyUterine',amount=profile.fluid[c];
    result.status=`${uterine?l('宫腔','Uterus'):l('阴道','Vagina')} · ${amount} / ${profile.capacity[c]} ${l('单位','units')}`;
    rows.push(buttons(key(l('阴道','Vagina'),()=>patchPelvic(assetId,{container:'vaginal'}),{active:!uterine}),
      key(l('宫腔','Uterus'),()=>patchPelvic(assetId,{container:'fantasyUterine'}),{active:uterine})),
      note(l('喷口在内时计入所选部位；棒头仍止于宫颈。','An inside release fills the selected site. The rod still stops at the cervix.')),
      field(l('容量','Capacity'),profile.capacity[c],l(' 单位',' units'),lim.capacity,1,n=>setPelvicCapacity(assetId,n)),
      buttons(key(l('排出 1 单位','Drain 1 unit'),()=>drainPelvic(assetId,1),{disabled:!amount}),key(l('清空此处','Empty site'),()=>clearPelvicFluid(assetId),{disabled:!amount,danger:!!amount})),
      link(l('返回观察图','Back to anatomy'),()=>go('view')));
  }else if(page==='view'){
    result.status=!mode?l('还没有放置假阳具。','No rod placed.'):
      covered?coverage:!running?waiting:signal==='inside'?l('棒头已进入阴道。','The tip is inside the vagina.'):
      signal==='outside'?l('棒头在入口外。','The tip is outside the opening.'):l('尚未确认杆位。','Rod position not verified.');
    result.warn=!!covered;
    if(running&&mode==='standManual')rows.push(jog());
    if(running&&mode!=='xrManual')rows.push(dose());
    rows.push(link(l('精液存量与容量','Semen amount and capacity'),()=>go('fluid')));
    if(!mode)rows.push(link(l('去放置假阳具','Place the rod'),()=>go('use')));
  }else{
    if(!support){result.status=l('正在寻找角色的入口…','Locating the opening…');}
    else if(!known){result.warn=true;result.status=l('未找到可用的骨盆骨骼。','No usable pelvic bones found.');rows.push(main(l('手动定位入口','Locate opening manually'),relocate));}
    else if(!mode){
      result.status=l('此角色还没有放置假阳具。先放到入口外，再推进。','No rod placed for this actor. Position it outside the opening first.');
      rows.push(main(l('把假阳具放到入口外','Place rod outside opening'),()=>assign('standManual')));
    }else if(covered){
      result.status=`${waiting} ${coverage}`;result.warn=true;
      rows.push(main(clothesLabel,clothes),link(l('重调入口位置','Refit opening'),openFit));
    }else if(!profile.clothingClear){
      result.status=`${waiting} ${l('看看入口是否露出。','Check that the opening is exposed.')}`;
      rows.push(main(l('我看到了入口','I can see the opening'),()=>patchPelvic(assetId,{clothingClear:true})),link(clothesLabel,clothes));
    }else if(!running){
      result.status=waiting;
      rows.push(main(mode==='xrManual'?l('开始手持并收起面板','Start hand control'):mode==='standAuto'?l('开始自动往复','Start motor'):
        withdrawFirst?l('先退回入口外','Withdraw to re-align'):l('向内推一段','Advance the rod'),start,mode!=='xrManual'&&signal!=='parked'));
    }else{
      result.status=signal==='inside'?l('棒头已进入阴道。','The tip is inside the vagina.'):
        signal==='outside'?l('棒头在入口外。','The tip is outside the opening.'):
        signal==='unverified'?l('未确认进入。退回入口外再对准。','Entry not verified. Withdraw and re-align.'):
        l('正在读取棒头位置…','Reading the tip position…');
      if(mode==='standManual')rows.push(field(l('支架位置','Rail position'),Math.round(target*100),'%',[-20,100],5,p=>setTarget(p/100)),jog());
      if(mode==='standAuto')rows.push(field(l('每秒往复','Cycles per second'),profile.speedHz,' Hz',lim.speedHz,.1,n=>patchPelvic(assetId,{speedHz:n})),
        field(l('往复幅度','Stroke length'),profile.stroke*100,'%',percentRange(lim.stroke),5,n=>patchPelvic(assetId,{stroke:n/100})));
      if(mode!=='xrManual')rows.push(dose(),balance());
    }
    if(known)rows.push(link(mode?l('换拿法或收起','Change holder or put away'):l('其他拿法','Other holders'),()=>go('holder')));
    if(mode&&known&&!covered&&profile.clothingClear)rows.push(link(clothesLabel,clothes));
  }
  return result;
}
