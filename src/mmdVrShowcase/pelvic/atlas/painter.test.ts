import {afterEach,expect,it,vi} from 'vitest';
import {usePelvic} from '../store';
import {defaultPelvicCalibration} from '../contract';
import {useBodyState} from '../../bodyState/store';
import {DEFAULT_BODY_PROFILE,sampleBody} from '../../bodyState/data';
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
  const driver=atlasPainter(paper(),{assetId,runtimeId},'pelvic',wake,()=>{}),last=()=>art.draw.mock.lastCall![1];
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
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'ra'},'pelvic',()=>{},upload);
  try{
    expect(driver.tick(0)).toBe(false);
    usePelvic.setState({active:{assetId:'b',runtimeId:'rb',token:1,mode:'standAuto',source:'xr',running:true,awaitingWorld:false,position:0}});
    worker.reply();driver.tick(1000);expect(upload).toHaveBeenCalledOnce();expect(worker.current.postMessage).toHaveBeenCalledOnce();
    expect(worker.current.postMessage.mock.lastCall![0].options.sample).toBeNull();
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

it('invalidates a ready bitmap on a stop-limit crossing or a mode round trip between drawing frames',()=>{
  const worker=slowWorker(),upload=vi.fn();setAtlasView('a',{motion:false});
  const sample={tip:[0,0,-.1] as const,tail:[0,0,.1] as const,depth:.1,angleDeg:0,radiusM:.02,lengthM:.1,
    aligned:false,outletInside:false,outletVisible:false,atCervix:false};
  usePelvic.setState({byAsset:{a:calibrated},active:{assetId:'a',runtimeId:'r',token:1,mode:'standAuto',source:'xr',running:true,awaitingWorld:false,position:0},sample});
  const driver=atlasPainter(paper(),{assetId:'a',runtimeId:'r'},'pelvic',()=>{},upload);
  try{
    driver.tick(0);const first=worker.reply();usePelvic.setState({sample:{...sample,atCervix:true}});
    driver.tick(10);expect(first.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    const second=worker.reply(),old=worker.current;setAtlasView('a',{mode:'measure'});setAtlasView('a',{mode:'organ'});
    driver.tick(20);expect(old.terminate).toHaveBeenCalledOnce();expect(second.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    expect(worker.current.postMessage.mock.lastCall![0].options.sample.atCervix).toBe(true);
    worker.reply();driver.tick(30);expect(upload).toHaveBeenCalledOnce();
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
