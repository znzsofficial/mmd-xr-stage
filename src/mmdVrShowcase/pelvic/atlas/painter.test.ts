import {afterEach,expect,it,vi} from 'vitest';
import {usePelvic} from '../store';
import {defaultPelvicCalibration} from '../contract';
import {useBodyState} from '../../bodyState/store';
import {DEFAULT_BODY_PROFILE,sampleBody} from '../../bodyState/data';
import {atlasPainter} from './painter';
import {setAtlasView,useAtlasSettings} from './view';

const art=vi.hoisted(()=>({draw:vi.fn(),dispose:vi.fn()}));
vi.mock('./organArt',()=>({createOrganArt:()=>art}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();useAtlasSettings.setState({actors:{}});usePelvic.setState(usePelvic.getInitialState());useBodyState.setState(useBodyState.getInitialState());});
function paper(){
  const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
  return {width:688,height:564,dataset:{},setAttribute:()=>{},getAttribute:()=>null,getContext:()=>ctx} as unknown as HTMLCanvasElement;
}
it('freezes only illustrative motion: camera and actual dose data stay live without starting a simulated rod or changing the day',()=>{
  const assetId='actor',runtimeId='instance';
  const body={...DEFAULT_BODY_PROFILE,day:3};useBodyState.setState({byAsset:{[assetId]:body}});
  const p={calibration:defaultPelvicCalibration,clothingClear:true,container:'fantasyUterine' as const,showAdapter:false,
    fluid:{vaginal:1,fantasyUterine:3},capacity:{vaginal:4,fantasyUterine:12},drained:0,overflow:0,stroke:.5,speedHz:1};
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

it('does not display a late worker frame from an old cycle preview after the user freezes a new day',()=>{
  let worker:Stub|undefined;
  class Stub{constructor(){worker=this;}postMessage=vi.fn();terminate(){}onmessage?:Function;}
  vi.stubGlobal('Worker',Stub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  const b={...DEFAULT_BODY_PROFILE,day:4};useBodyState.setState({byAsset:{a:b}});
  const canvas=paper(),upload=vi.fn(),driver=atlasPainter(canvas,{assetId:'a',runtimeId:'m'},'body',()=>{},upload);
  try{
    driver.tick(1);expect(worker!.postMessage).toHaveBeenCalledOnce();
    useBodyState.setState({draft:{assetId:'a',value:{...b,day:22}}});setAtlasView('a',{motion:false});driver.tick(31);
    const b1={close:vi.fn()};worker!.onmessage!({data:{bitmap:b1}});
    expect(b1.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();expect(worker!.postMessage).toHaveBeenCalledTimes(2);
    const b2={close:vi.fn()};worker!.onmessage!({data:{bitmap:b2}});expect(b2.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
    expect(worker!.postMessage.mock.lastCall![0].options.lining).toBe(sampleBody({...b,day:22}).lining);
  }finally{driver.dispose();}
});
