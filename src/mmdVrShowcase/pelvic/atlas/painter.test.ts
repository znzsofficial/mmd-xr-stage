import {afterEach,expect,it,vi} from 'vitest';
import {useBackpack} from '../../backpack/store';
import {usePelvic} from '../store';
import {defaultPelvicCalibration} from '../contract';
import {useBodyState} from '../../bodyState/store';
import {DEFAULT_BODY_PROFILE} from '../../bodyState/data';
import {chanceFor,eggsFor,forceOvulation,recordInternalDose,setConceptionChance,useConception,type ConceptionEvent} from '../../bodyState/reproduction/store';
import {createEggReplay} from '../../bodyState/reproduction/eggReplay';
import {atlasPainter} from './painter';
import {setAtlasView,useAtlasSettings} from './view';
import {useLanguageStore} from '../../../languageStore';

const art=vi.hoisted(()=>({draw:vi.fn(),dispose:vi.fn()}));
vi.mock('./organArt',()=>({createOrganArt:()=>art}));
afterEach(()=>{
  useBackpack.setState(useBackpack.getInitialState());useAtlasSettings.setState({actors:{}});
  usePelvic.setState(usePelvic.getInitialState());useBodyState.setState(useBodyState.getInitialState());useConception.setState(useConception.getInitialState());
  useLanguageStore.setState(useLanguageStore.getInitialState());vi.clearAllMocks();vi.unstubAllGlobals();
});
function paper(){
  const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
  return {width:688,height:564,dataset:{},setAttribute:()=>{},getAttribute:()=>null,getContext:()=>ctx} as unknown as HTMLCanvasElement;
}
const calibrated={calibration:defaultPelvicCalibration,clothingClear:true,container:'fantasyUterine' as const,showAdapter:false,
  fluid:{vaginal:1,fantasyUterine:3},capacity:{vaginal:4,fantasyUterine:12},drained:0,overflow:0,stroke:.5,speedHz:1};
const actor={assetId:'a',runtimeId:'r'};
function seedEvent(success:boolean):ConceptionEvent{
  const event:ConceptionEvent={id:37,at:1000,chance:60,success,side:-1};
  useConception.setState({byAsset:{a:{chance:60,event,eggs:[{id:1,side:-1,fertilized:success,event}]}}});return event;
}
const lastDraw=()=>art.draw.mock.lastCall![1];
it('holds the displayed encounter when frozen, while actual balances and camera angle remain live',()=>{
  const event=seedEvent(true),wake=vi.fn(),upload=vi.fn();setAtlasView('a',{motion:true,degrees:0});
  usePelvic.setState({byAsset:{a:calibrated}});
  const p=atlasPainter(paper(),actor,'uterus',wake,upload);
  try{
    p.tick(event.at+4000);expect(lastDraw()).toMatchObject({event,encounterSeconds:4,fluid:.25,sample:null});
    setAtlasView('a',{motion:false,degrees:90});p.tick(event.at+4100);
    const {time,encounterSeconds}=lastDraw(),n=upload.mock.calls.length;
    expect(encounterSeconds).toBe(4);p.tick(event.at+15000);expect(upload).toHaveBeenCalledTimes(n);
    usePelvic.setState({byAsset:{a:{...calibrated,fluid:{...calibrated.fluid,fantasyUterine:6}}}});p.tick(event.at+15100);
    expect(upload).toHaveBeenCalledTimes(n+1);expect(lastDraw()).toMatchObject({time,encounterSeconds,yaw:Math.PI/2,fluid:.5,uterineFluid:.5,sample:null});
    expect(usePelvic.getState().active).toBeNull();
  }finally{p.dispose();}
  const n=wake.mock.calls.length;setAtlasView('a',{degrees:30});expect(wake).toHaveBeenCalledTimes(n);
});

function slowWorker(){
  let worker:Stub;
  class Stub{constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();onmessage?:Function;}
  vi.stubGlobal('Worker',Stub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  return {get current(){return worker;},options:()=>worker.postMessage.mock.lastCall![0].options,
    reply(){const b={close:vi.fn()};worker.onmessage!({data:{bitmap:b}});return b;}};
}
it('invalidates only the observed egg bitmap; another egg can receive the dose while the player keeps this one selected',()=>{
  useBackpack.setState({entries:['a','b'].map(id=>({id,kind:'model' as const,path:'fixture.pmx',file:new File([],'fixture.pmx')})),
    selected:'b',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]},b:{runtimeId:'r2',visible:true,position:[0,0,0]}}});
  forceOvulation('b','r2');useBackpack.setState({selected:'a'});forceOvulation('a','r');forceOvulation('a','r');
  expect(setConceptionChance('a','r',100)).toBe(true);setAtlasView('a',{motion:false});
  const worker=slowWorker(),upload=vi.fn(),p=atlasPainter(paper(),actor,'egg',()=>{},upload);
  try{
    p.tick(0);expect(worker.options().egg.event).toBeUndefined();const obsolete=worker.reply();
    recordInternalDose('a',1);const event=useConception.getState().byAsset.a.event!;
    expect(event).toMatchObject({chance:100,success:true});p.tick(event.at);
    expect(obsolete.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    expect(worker.options()).toMatchObject({egg:{id:1,event},focus:'egg',encounterSeconds:12});
    const valid=worker.reply();expect(setConceptionChance('a','r',0)).toBe(true);expect(chanceFor('a')).toBe(0);
    recordInternalDose('a',0);recordInternalDose('b',1);expect(useConception.getState().byAsset.b.event).toBeDefined();
    expect(useConception.getState().byAsset.a.event).toBe(event);expect(upload).not.toHaveBeenCalled();
    p.tick(event.at+100);expect(valid.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
    p.tick(event.at+1000);expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    recordInternalDose('a',1);p.tick(event.at+1010);
    expect(worker.current.postMessage).toHaveBeenCalledTimes(2);expect(eggsFor('a')[1].event).toMatchObject({success:false,chance:0});
    setAtlasView('a',{eggId:2});p.tick(event.at+1011);expect(worker.options().egg).toMatchObject({id:2,event:eggsFor('a')[1].event});
    expect(worker.current.postMessage).toHaveBeenCalledTimes(3);
    setAtlasView('a',{eggId:1});const late=worker.reply();p.tick(event.at+1012);
    expect(upload).toHaveBeenCalledOnce();expect(late.close).toHaveBeenCalledOnce();expect(worker.options().egg).toMatchObject({id:1,event});
  }finally{p.dispose();}
});

it('reopens mid-encounter at the age of the same delivery instead of replaying the start',()=>{
  const event=seedEvent(false),wake=vi.fn();setAtlasView('a',{motion:true});
  const open=()=>atlasPainter(paper(),actor,'egg',wake,()=>{}),first=open();
  try{
    first.tick(event.at+2000);expect(lastDraw()).toMatchObject({egg:{event},encounterSeconds:2,focus:'egg'});
    useConception.setState({byAsset:{a:{...useConception.getState().byAsset.a,chance:95}}});
    expect(wake).not.toHaveBeenCalled();first.tick(event.at+3500);expect(lastDraw()).toMatchObject({egg:{event},encounterSeconds:3.5});
  }finally{first.dispose();}
  const reopened=open();
  try{reopened.tick(event.at+7500);expect(lastDraw()).toMatchObject({egg:{event},encounterSeconds:7.5,focus:'egg'});}
  finally{reopened.dispose();}
  expect(useConception.getState().byAsset.a.event).toBe(event);
});

it('drops obsolete bitmaps at replay start and stop and skips hidden time on the diagram clock',()=>{
  const event=seedEvent(false),worker=slowWorker(),upload=vi.fn(),replay=createEggReplay();setAtlasView('a',{motion:false});
  const p=atlasPainter(paper(),actor,'egg',()=>{},upload,replay);
  try{
    p.tick(20000);replay.start(event);p.tick(21000);expect(worker.reply().close).toHaveBeenCalledOnce();
    p.tick(24000);expect(worker.options()).toMatchObject({egg:{event},encounterSeconds:0});expect(upload).not.toHaveBeenCalled();
    worker.reply();p.tick(28000);expect(worker.options().encounterSeconds).toBe(4);p.suspend();expect(worker.reply().close).toHaveBeenCalledOnce();
    p.tick(80000);expect(worker.options().encounterSeconds).toBe(4);const stale=worker.reply();replay.stop();
    p.tick(80100);expect(stale.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledTimes(1);
    expect(worker.options()).toMatchObject({egg:{event},encounterSeconds:12});worker.reply();expect(p.tick(80200)).toBe(false);
    expect(upload).toHaveBeenCalledTimes(2);
  }finally{p.dispose();}
});

it.each([true,false])('uploads the exact 12-second frame once, then rests (success=%s)',success=>{
  const event=seedEvent(success),worker=slowWorker(),upload=vi.fn(),wake=vi.fn();setAtlasView('a',{motion:true});
  const p=atlasPainter(paper(),actor,'egg',wake,upload);
  try{
    const end=event.at+12000;p.tick(end-10);expect(worker.options().encounterSeconds).toBeCloseTo(11.99);
    worker.reply();expect(p.tick(end-9)).toBe(true);expect(upload).toHaveBeenCalledOnce();
    // Cross the endpoint inside the normal frame-rate limit. A request for
    // 11.99 is not the terminal image, even though no animation time remains.
    p.tick(end);expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.options()).toMatchObject({egg:{event},encounterSeconds:12});wake.mockClear();const terminal=worker.reply();expect(wake).toHaveBeenCalled();
    expect(upload).toHaveBeenCalledOnce();expect(p.tick(end+1)).toBe(false);
    expect(terminal.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledTimes(2);
    for(const elapsed of [80,250,5000])expect(p.tick(end+elapsed)).toBe(false);
    expect(worker.current.postMessage).toHaveBeenCalledTimes(2);expect(upload).toHaveBeenCalledTimes(2);
  }finally{p.dispose();}
});

it('rests with an empty egg lens, independent of the stand; manual ovulation wakes it without a delivery',()=>{
  const wake=vi.fn(),upload=vi.fn();setAtlasView('a',{motion:true,degrees:0});
  const p=atlasPainter(paper(),actor,'egg',wake,upload);
  try{
    expect(p.tick(0)).toBe(false);expect(lastDraw()).toMatchObject({focus:'egg',egg:undefined,yaw:0,sample:null});
    expect(lastDraw().event).toBeUndefined();expect(useConception.getState().byAsset.a).toBeUndefined();
    usePelvic.setState({byAsset:{a:calibrated},active:{...actor,mode:'standAuto',source:'screen',token:1,running:true,position:.3,awaitingWorld:false}});
    for(const t of [100,1000,10000])expect(p.tick(t)).toBe(false);
    expect(upload).toHaveBeenCalledOnce();wake.mockClear();setAtlasView('a',{degrees:90});expect(wake).toHaveBeenCalled();
    p.tick(10050);expect(upload).toHaveBeenCalledTimes(2);expect(lastDraw().yaw).toBeGreaterThan(0);
    expect(lastDraw().event).toBeUndefined();expect(lastDraw().sample).toBeNull();
    useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'fixture.pmx'),path:'fixture.pmx'}],live:{a:{visible:true,runtimeId:'r',position:[0,0,0]}}});
    expect(forceOvulation('a','r')).toBe(true);p.tick(10051);expect(lastDraw().egg).toMatchObject({id:1,fertilized:false});expect(lastDraw().egg.event).toBeUndefined();
  }finally{p.dispose();}
});

it('discards the late worker reply for a previous angle and paints the new angle only on the destination frame',()=>{
  const worker=slowWorker(),upload=vi.fn(),canvas=paper();setAtlasView('a',{motion:false,degrees:0});
  const p=atlasPainter(canvas,actor,'uterus',()=>{},upload);
  try{
    p.tick(0);setAtlasView('a',{degrees:90});p.tick(1);const stale=worker.reply();p.tick(2);
    expect(stale.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.options().yaw).toBe(Math.PI/2);const fresh=worker.reply();expect(upload).not.toHaveBeenCalled();
    p.tick(3);expect(canvas.dataset.angle).toBe('90');expect(fresh.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
  }finally{p.dispose();}
});

it('publishes the frozen first frame of A even if B acquires the active socket before the worker replies',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});
  usePelvic.setState({byAsset:{a:calibrated}});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'ra'},'uterus',()=>{},upload);
  try{
    expect(driver.tick(0)).toBe(false);
    usePelvic.setState({active:{assetId:'b',runtimeId:'rb',token:1,mode:'standAuto',source:'xr',running:true,awaitingWorld:false,position:0}});
    worker.reply();driver.tick(1000);expect(upload).toHaveBeenCalledOnce();expect(worker.current.postMessage).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.sample).toBeNull();
  }finally{driver.dispose();}
});

it('drops a hidden completion and resumes a frozen view without catching up or publishing from the message callback',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});
  const driver=atlasPainter(paper(),actor,'body',()=>{},upload);
  try{
    driver.tick(0);driver.suspend();expect(worker.reply().close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    driver.tick(8900);expect(worker.current.postMessage).toHaveBeenCalledTimes(2);const b=worker.reply();expect(upload).not.toHaveBeenCalled();
    driver.tick(9000);expect(upload).toHaveBeenCalledOnce();expect(b.close).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.time).toBe(0);
  }finally{driver.dispose();}
});

it.each(['body','uterus'] as const)('uses the same %s reference across saved body settings, preview edits and cancellation',scope=>{
  const worker=slowWorker(),upload=vi.fn(),wake=vi.fn();setAtlasView('a',{motion:false,degrees:0});
  const driver=atlasPainter(paper(),actor,scope,wake,upload);
  try{
    driver.tick(0);const reference=worker.options();worker.reply();wake.mockClear();
    useBodyState.setState({byAsset:{a:{...DEFAULT_BODY_PROFILE,fullness:.9}},draft:{assetId:'a',value:{...DEFAULT_BODY_PROFILE,left:.1}}});
    driver.tick(100);expect(upload).toHaveBeenCalledOnce();expect(worker.current.postMessage).toHaveBeenCalledOnce();expect(wake).not.toHaveBeenCalled();
    setAtlasView('a',{degrees:90});driver.tick(110);expect(worker.options()).toEqual({...reference,yaw:Math.PI/2});
    worker.reply();useBodyState.setState({draft:null});driver.tick(120);
    expect(worker.current.postMessage).toHaveBeenCalledTimes(2);expect(upload).toHaveBeenCalledTimes(2);
  }finally{driver.dispose();}
});

it('invalidates a ready bitmap on a stop-limit crossing but keeps the body view independent of the measurement selector',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});
  const sample={tip:[0,0,-.1] as const,tail:[0,0,.1] as const,depth:.1,angleDeg:0,radiusM:.02,lengthM:.1,
    aligned:false,outletInside:false,outletVisible:false,atCervix:false};
  usePelvic.setState({byAsset:{a:calibrated},active:{assetId:'a',runtimeId:'r',token:1,mode:'standAuto',source:'xr',running:true,awaitingWorld:false,position:0},sample});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'uterus',()=>{},upload);
  try{
    driver.tick(0);const first=worker.reply();usePelvic.setState({sample:{...sample,atCervix:true}});
    driver.tick(10);expect(first.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    const second=worker.reply(),old=worker.current;setAtlasView('a',{mode:'measure'});setAtlasView('a',{mode:'entry'});
    driver.tick(20);expect(old.terminate).not.toHaveBeenCalled();expect(second.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.sample.atCervix).toBe(true);
    driver.tick(30);expect(upload).toHaveBeenCalledOnce();
  }finally{driver.dispose();}
});

it('keeps painting a moving orbit at a bounded cadence during a stream of pointer events',()=>{
  setAtlasView('a',{degrees:0,motion:true});
  const driver=atlasPainter(paper(),actor,'body',()=>{},()=>{});
  try{
    driver.tick(0);for(let deg=1;deg<=18;deg++){setAtlasView('a',{degrees:deg});driver.tick(deg*8);}
    expect(art.draw.mock.calls.length).toBeGreaterThan(1);expect(art.draw.mock.calls.length).toBeLessThanOrEqual(5);
  }finally{driver.dispose();}
});

it.each(['vagina','vulva','uterus'] as const)('stops serializing stationary %s, but repaints when the shaft shifts with an unchanged tip',focus=>{
  const assetId='actor',runtimeId='id',sample={tip:[0,0,-.02] as const,tail:[0,0,.05] as const,shaft:[[0,0,.05],[0,0,-.02]] as const,
    outletInside:true,aligned:true,atCervix:false,depth:.02,radiusM:.024,lengthM:.09,angleDeg:0};
  setAtlasView(assetId,{motion:true});usePelvic.setState({byAsset:{actor:calibrated},sample,
    active:{assetId,runtimeId,token:1,mode:'standManual',source:'xr',running:true,awaitingWorld:false,position:.2}});
  const upload=vi.fn(),p=atlasPainter(paper(),{assetId,runtimeId},focus,()=>{},upload);
  try{p.tick(0);for(let i=1;i<=12;i++){usePelvic.setState({sample:structuredClone(sample)});p.tick(i*100);}
    expect(upload).toHaveBeenCalledOnce();usePelvic.setState({sample:{...sample,shaft:[[.003,0,.05],sample.tip]}});p.tick(1300);
    expect(upload).toHaveBeenCalledTimes(2);setAtlasView(assetId,{degrees:90});p.tick(1400);expect(upload).toHaveBeenCalledTimes(3);
  }finally{p.dispose();}
});

it('replaces a ready exterior bitmap after a DOM pixel-tier change; a held still window uploads once',()=>{
  let cssWidth=156,resize=()=>{};const disconnect=vi.fn(),off=vi.fn();
  const screenWindow={devicePixelRatio:1,addEventListener:vi.fn(),removeEventListener:off};vi.stubGlobal('window',screenWindow);
  vi.stubGlobal('ResizeObserver',class {constructor(cb:()=>void){resize=cb;}observe(){}disconnect=disconnect;});
  const canvas=Object.assign(paper(),{isConnected:true,getBoundingClientRect:()=>({width:cssWidth,height:cssWidth*282/344})});
  const worker=slowWorker(),upload=vi.fn(),p=atlasPainter(canvas,actor,'vulva',()=>{},upload);
  const scale=()=>worker.current.postMessage.mock.lastCall![0].scale;
  try{
    p.tick(0);expect(scale()).toBe(.5);expect(canvas.width).toBe(688);const stale=worker.reply();
    cssWidth=420;resize();p.tick(16);expect(stale.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();expect(scale()).toBe(1.25);
    const current=worker.reply();p.tick(32);expect(current.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
    cssWidth=425;resize();p.tick(48);expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    screenWindow.devicePixelRatio=2;resize();p.tick(64);expect(scale()).toBe(2.5);expect(canvas.width).toBe(860);
    worker.reply();p.tick(80);cssWidth=156;screenWindow.devicePixelRatio=1;resize();p.tick(96);expect(scale()).toBe(.5);expect(canvas.width).toBe(688);
    worker.reply();p.tick(112);p.tick(2000);expect(upload).toHaveBeenCalledTimes(3);
  }finally{p.dispose();}expect(disconnect).toHaveBeenCalledOnce();expect(off).toHaveBeenCalled();
});

it.each(['vulva','vagina','uterus'] as const)('observes %s without enabling a socket and follows only the selected runtime while the figure is frozen',focus=>{
  setAtlasView('a',{mode:'measure',motion:false});
  const canvas=paper(),driver=atlasPainter(canvas,{assetId:'a',runtimeId:'r'},focus,()=>{},()=>{}),latest=()=>art.draw.mock.lastCall![1];
  try{
    driver.tick(0);expect(canvas.dataset.view).toBe(focus);expect(latest()).toMatchObject({focus,time:0,sample:null,pressure:0});
    expect(useBodyState.getState()).toMatchObject({draft:null,byAsset:{}});expect(usePelvic.getState()).toMatchObject({active:null,byAsset:{}});
    const sample={tip:[0,0,-.04] as const,tail:[0,0,.03] as const,outletInside:true,aligned:true,atCervix:false,depth:.04,radiusM:.02,lengthM:.1,angleDeg:0};
    const a={assetId:'a',runtimeId:'previous',running:true,position:.99,token:47,mode:'standAuto' as const,source:'xr' as const,awaitingWorld:false};
    const profile={...calibrated,container:'vaginal' as const,fluid:{vaginal:2,fantasyUterine:3}};
    usePelvic.setState({byAsset:{a:profile},active:a,sample});driver.tick(20);expect(latest().sample).toBeNull();
    usePelvic.setState({active:{...a,runtimeId:'r',token:48}});
    for(const degrees of [0,38,90]){setAtlasView('a',{degrees});driver.tick(60+degrees);expect(latest()).toMatchObject({focus,time:0,sample,parked:false,
      yaw:degrees*Math.PI/180,vaginalFluid:.5,uterineFluid:focus==='uterus'?.25:undefined});expect(latest().pressure).toBeCloseTo(.4);}
    const moved={...sample,depth:.06,tip:[0,0,-.06] as const};usePelvic.setState({sample:moved});driver.tick(200);
    expect(latest()).toMatchObject({sample:moved,parked:false,time:0});expect(latest().pressure).toBeCloseTo(.6);
    const parked={...sample,outletInside:false};usePelvic.setState({active:{...a,runtimeId:'r',token:49,running:false},sample:null,parkedSample:parked});driver.tick(300);
    expect(latest()).toMatchObject({sample:parked,parked:true,pressure:0,time:0});
    usePelvic.setState({active:null,parkedSample:null});driver.tick(500);expect(latest().sample).toBeNull();
    expect(usePelvic.getState().byAsset.a).toBe(profile);expect(useBodyState.getState()).toMatchObject({draft:null,byAsset:{}});
  }finally{driver.dispose();}
});
