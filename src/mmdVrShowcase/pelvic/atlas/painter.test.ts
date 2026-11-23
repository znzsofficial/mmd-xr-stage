import {afterEach,expect,it,vi} from 'vitest';
import {usePelvic} from '../store';
import {defaultPelvicCalibration} from '../contract';
import {useBodyState} from '../../bodyState/store';
import {DEFAULT_BODY_PROFILE,sampleBody} from '../../bodyState/data';
import {configureReproduction,recordInternalDose,useReproduction} from '../../bodyState/reproduction/store';
import {mockGameEntropy} from '../../bodyState/reproduction/entropy.testSupport';
import {atlasPainter} from './painter';
import {setAtlasView,useAtlasSettings} from './view';
import {useLanguageStore} from '../../../languageStore';

const art=vi.hoisted(()=>({draw:vi.fn(),dispose:vi.fn()}));
vi.mock('./organArt',()=>({createOrganArt:()=>art}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();useAtlasSettings.setState({actors:{}});usePelvic.setState(usePelvic.getInitialState());useBodyState.setState(useBodyState.getInitialState());useLanguageStore.setState(useLanguageStore.getInitialState());});
function paper(){
  const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
  return {width:688,height:564,dataset:{},setAttribute:()=>{},getAttribute:()=>null,getContext:()=>ctx} as unknown as HTMLCanvasElement;
}
const calibrated={calibration:defaultPelvicCalibration,clothingClear:true,container:'fantasyUterine' as const,showAdapter:false,
  fluid:{vaginal:1,fantasyUterine:3},capacity:{vaginal:4,fantasyUterine:12},drained:0,overflow:0,stroke:.5,speedHz:1};
it('freezes only illustrative motion: camera and actual dose data stay live without starting a simulated rod or changing the day',()=>{
  const assetId='actor',runtimeId='instance';
  const body={...DEFAULT_BODY_PROFILE,day:3};useBodyState.setState({byAsset:{[assetId]:body}});
  const p=calibrated;
  usePelvic.setState({byAsset:{[assetId]:p}});const wake=vi.fn();
  const driver=atlasPainter(paper(),{assetId,runtimeId},'uterus',wake,()=>{}),last=()=>art.draw.mock.lastCall![1];
  try{
    driver.tick(100);driver.tick(200);expect(last().time).toBeGreaterThan(0);
    setAtlasView(assetId,{motion:false,degrees:90});expect(driver.tick(220)).toBe(false);
    const stopped=last().time,count=art.draw.mock.calls.length;driver.tick(800);expect(art.draw.mock.calls.length).toBe(count);
    usePelvic.setState({byAsset:{[assetId]:{...p,fluid:{...p.fluid,fantasyUterine:6}}}});driver.tick(850);
    expect(last()).toMatchObject({time:stopped,yaw:Math.PI/2,fluid:.5,lining:sampleBody(body).lining,sample:null});
    setAtlasView(assetId,{degrees:0});driver.tick(900);expect(last().yaw).toBe(0);expect(usePelvic.getState().active).toBeNull();
    expect(useBodyState.getState().byAsset[assetId]).toBe(body);
  }finally{driver.dispose();}const n=wake.mock.calls.length;setAtlasView(assetId,{degrees:30});expect(wake).toHaveBeenCalledTimes(n);
});

function slowWorker(){
  let worker:Stub;
  class Stub{constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();onmessage?:Function;}
  vi.stubGlobal('Worker',Stub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  return {get current(){return worker;},reply(){const b={close:vi.fn()};worker.onmessage!({data:{bitmap:b}});return b;}};
}
it('supersedes a frozen uterus bitmap on the actual game trial, but not on another actor’s trial or a replayed dose',()=>{
  const entropy=mockGameEntropy(5,1);
  const worker=slowWorker(),upload=vi.fn(),assetId='asset-1',other='asset-2',profile={...DEFAULT_BODY_PROFILE,day:15,reproduction:true};
  configureReproduction(assetId,profile);configureReproduction(other,profile);setAtlasView(assetId,{motion:false});
  const painter=atlasPainter(paper(),{assetId,runtimeId:'r'},'uterus',()=>{},upload),options=()=>worker.current.postMessage.mock.lastCall![0].options;
  try{
    painter.tick(0);expect(options().reproduction).toMatchObject({eggs:1,chance:60,tried:false,stage:'ovulated'});
    const obsolete=worker.reply();recordInternalDose(other,1);recordInternalDose(assetId,1);painter.tick(1);
    expect(obsolete.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();expect(options()).toMatchObject({time:0,reproductionSeconds:12,reproduction:{tried:true,stage:'fertilized',implanted:false}});
    expect(options().reproduction).not.toHaveProperty('trial');const valid=worker.reply();recordInternalDose(assetId,1);recordInternalDose(other,1);painter.tick(2);
    expect(valid.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
  }finally{painter.dispose();useReproduction.setState(useReproduction.getInitialState());entropy.mockRestore();}
});
it('does not display a late worker frame from an old cycle preview after the user freezes a new day',()=>{
  const worker=slowWorker();
  const b={...DEFAULT_BODY_PROFILE,day:4};useBodyState.setState({byAsset:{a:b}});
  const canvas=paper(),upload=vi.fn(),driver=atlasPainter(canvas,{assetId:'a',runtimeId:'m'},'body',()=>{},upload);
  try{
    driver.tick(1);expect(worker.current.postMessage).toHaveBeenCalledOnce();
    useBodyState.setState({draft:{assetId:'a',value:{...b,day:22}}});setAtlasView('a',{motion:false});driver.tick(31);
    const b1=worker.reply();driver.tick(35);
    expect(b1.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    const b2=worker.reply();expect(upload).not.toHaveBeenCalled();driver.tick(38);
    expect(b2.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.lining).toBe(sampleBody({...b,day:22}).lining);
  }finally{driver.dispose();}
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

it('opens an unsaved cycle at the read-only defaults and discards a cancelled first preview before it can reach the canvas',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'ra'},'body',()=>{},upload);
  const options=()=>worker.current.postMessage.mock.lastCall![0].options;
  try{
    driver.tick(0);const initial=options();expect(initial.lining).toBe(sampleBody(DEFAULT_BODY_PROFILE).lining);
    worker.reply();driver.tick(1);expect(upload).toHaveBeenCalledOnce();
    useBodyState.setState({draft:{assetId:'a',value:{...DEFAULT_BODY_PROFILE,day:11,liningOverride:.05}}});
    driver.tick(2);expect(options().lining).toBe(.05);const obsolete=worker.reply();
    useBodyState.setState({draft:null});driver.tick(3);
    expect(obsolete.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();expect(options()).toEqual(initial);
    worker.reply();driver.tick(4);expect(upload).toHaveBeenCalledTimes(2);expect(useBodyState.getState().byAsset).toEqual({});
  }finally{driver.dispose();}
});

it('drops a hidden completion and resumes a frozen view without catching up or publishing from the message callback',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});useBodyState.setState({byAsset:{a:{...DEFAULT_BODY_PROFILE}}});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'body',()=>{},upload);
  try{
    driver.tick(0);driver.suspend();expect(worker.reply().close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    driver.tick(8900);expect(worker.current.postMessage).toHaveBeenCalledTimes(2);const b=worker.reply();expect(upload).not.toHaveBeenCalled();
    driver.tick(9000);expect(upload).toHaveBeenCalledOnce();expect(b.close).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.time).toBe(0);
  }finally{driver.dispose();}
});

it('does not rasterize a frozen, locked cycle diagram for unrelated refill ticks',()=>{
  const body={...DEFAULT_BODY_PROFILE,locked:true,lactating:true};useBodyState.setState({byAsset:{a:body}});setAtlasView('a',{motion:false});
  const upload=vi.fn(),driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'body',()=>{},upload);
  try{
    driver.tick(0);for(let i=1;i<=4;i++){useBodyState.setState({byAsset:{a:{...body,left:.5+i*.001}}});driver.tick(i*250);}
    expect(upload).toHaveBeenCalledOnce();
  }finally{driver.dispose();}
});

it('repaints a fixed-thickness frozen section when its gland and vessel architecture changes',()=>{
  const worker=slowWorker(),start={...DEFAULT_BODY_PROFILE,day:23,liningOverride:.55};
  setAtlasView('a',{motion:false});useBodyState.setState({byAsset:{a:start}});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'body',()=>{},()=>{});
  try{
    driver.tick(0);const first=worker.current.postMessage.mock.lastCall![0].options,oldBitmap=worker.reply();
    const updated={...start,ovulation:false};useBodyState.setState({byAsset:{a:updated}});driver.tick(50);
    const next=worker.current.postMessage.mock.lastCall![0].options;
    expect(oldBitmap.close).toHaveBeenCalledOnce();expect(worker.current.postMessage).toHaveBeenCalledTimes(2);
    expect(first.tissue).toEqual(sampleBody(start).tissue);expect(next.tissue).toEqual(sampleBody(updated).tissue);
    expect(first.tissue.functionalDepth).toBe(next.tissue.functionalDepth);expect(first.tissue.glandCoil).toBeGreaterThan(next.tissue.glandCoil);
    expect(next.time).toBe(first.time);
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
  useBodyState.setState({byAsset:{a:{...DEFAULT_BODY_PROFILE}}});setAtlasView('a',{degrees:0,motion:true});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'body',()=>{},()=>{});
  try{
    driver.tick(0);for(let deg=1;deg<=18;deg++){setAtlasView('a',{degrees:deg});driver.tick(deg*8);}
    expect(art.draw.mock.calls.length).toBeGreaterThan(1);expect(art.draw.mock.calls.length).toBeLessThanOrEqual(5);
  }finally{driver.dispose();}
});

it('stops serializing a stationary canal, but repaints when the shaft shifts with an unchanged tip',()=>{
  const assetId='actor',runtimeId='id',sample={tip:[0,0,-.02] as const,tail:[0,0,.05] as const,shaft:[[0,0,.05],[0,0,-.02]] as const,
    outletInside:true,aligned:true,atCervix:false,depth:.02,radiusM:.024,lengthM:.09,angleDeg:0};
  setAtlasView(assetId,{motion:true});usePelvic.setState({byAsset:{actor:calibrated},sample,
    active:{assetId,runtimeId,token:1,mode:'standManual',source:'xr',running:true,awaitingWorld:false,position:.2}});
  const upload=vi.fn(),p=atlasPainter(paper(),{assetId,runtimeId},'vagina',()=>{},upload);
  try{p.tick(0);for(let i=1;i<=12;i++){usePelvic.setState({sample:structuredClone(sample)});p.tick(i*100);}
    expect(upload).toHaveBeenCalledOnce();usePelvic.setState({sample:{...sample,shaft:[[.003,0,.05],sample.tip]}});p.tick(1300);
    expect(upload).toHaveBeenCalledTimes(2);setAtlasView(assetId,{degrees:90});p.tick(1400);expect(upload).toHaveBeenCalledTimes(3);
  }finally{p.dispose();}
});

it.each(['vulva','vagina','uterus'] as const)('observes %s without enabling a socket and follows only the selected runtime while the figure is frozen',focus=>{
  setAtlasView('a',{mode:'measure',motion:false});
  const canvas=paper(),driver=atlasPainter(canvas,{assetId:'a',runtimeId:'r'},focus,()=>{},()=>{}),latest=()=>art.draw.mock.lastCall![1];
  try{
    driver.tick(0);expect(canvas.dataset.view).toBe(focus);expect(latest()).toMatchObject({focus,time:0,sample:null,pressure:0});
    expect(useBodyState.getState()).toMatchObject({draft:null,byAsset:{}});expect(usePelvic.getState()).toMatchObject({active:null,byAsset:{}});
    const body={...DEFAULT_BODY_PROFILE,day:22};useBodyState.setState({byAsset:{a:body}});
    const sample={tip:[0,0,-.04] as const,tail:[0,0,.03] as const,outletInside:true,aligned:true,atCervix:false,depth:.04,radiusM:.02,lengthM:.1,angleDeg:0};
    const a={assetId:'a',runtimeId:'previous',running:true,position:.99,token:47,mode:'standAuto' as const,source:'xr' as const,awaitingWorld:false};
    const profile={...calibrated,container:'vaginal' as const,fluid:{vaginal:2,fantasyUterine:3}};
    usePelvic.setState({byAsset:{a:profile},active:a,sample});driver.tick(20);expect(latest().sample).toBeNull();
    usePelvic.setState({active:{...a,runtimeId:'r',token:48}});
    for(const degrees of [0,38,90]){setAtlasView('a',{degrees});driver.tick(60+degrees);expect(latest()).toMatchObject({focus,time:0,sample,parked:false,
      yaw:degrees*Math.PI/180,tissue:sampleBody(body).tissue,vaginalFluid:.5,uterineFluid:focus==='uterus'?.25:undefined});expect(latest().pressure).toBeCloseTo(.4);}
    const parked={...sample,outletInside:false};usePelvic.setState({active:{...a,runtimeId:'r',token:49,running:false},sample:null,parkedSample:parked});driver.tick(300);
    expect(latest()).toMatchObject({sample:parked,parked:true,pressure:0,time:0});
    usePelvic.setState({active:null,parkedSample:null});driver.tick(500);expect(latest().sample).toBeNull();
    expect(usePelvic.getState().byAsset.a).toBe(profile);expect(useBodyState.getState().byAsset.a).toBe(body);
  }finally{driver.dispose();}
});
