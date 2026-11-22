import {afterEach,expect,it,vi} from 'vitest';
import {DEFAULT_BODY_PROFILE,sampleBody} from '../data';
import {advanceLiveBodies,useBodyState} from '../store';
import {breastPainter} from './painter';
import {breastViews,setBreastView} from './view';

function canvas(){const ctx=new Proxy({}, {get:()=>()=>{}});return {width:800,height:520,getContext:()=>ctx,setAttribute(){},dataset:{}} as unknown as HTMLCanvasElement;}
function slowWorker(){
  let worker:WorkerStub;
  class WorkerStub{constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();onmessage?:Function;}
  vi.stubGlobal('Worker',WorkerStub);vi.stubGlobal('OffscreenCanvas',class{transferToImageBitmap(){}});
  let delivered=0;
  return {get current(){return worker;},get frame(){return worker.postMessage.mock.lastCall![0].options;},reply(){
    const b={close:vi.fn()};if(worker.postMessage.mock.calls.length>delivered){delivered++;worker.onmessage!({data:{bitmap:b}});}return b;}};
}
afterEach(()=>{useBodyState.setState(useBodyState.getInitialState());breastViews.setState({actors:{}});vi.unstubAllGlobals();});

it('uses the local day and draft without enabling a profile; even while frozen, only enabled left/right stores affect the picture',()=>{
  const w=slowWorker(),upload=vi.fn();setBreastView('a',{degrees:90,motion:false});
  const driver=breastPainter(canvas(),{assetId:'a',runtimeId:'r'},()=>{},upload),p={...DEFAULT_BODY_PROFILE,day:23,left:.2,right:.8};
  try{
    driver.tick(0);expect(useBodyState.getState().byAsset).toEqual({});expect(w.frame).toMatchObject({fullness:0,lactating:false,left:0,right:0,degrees:90,time:0,section:false,labels:false});
    w.reply();driver.tick(50);useBodyState.setState({byAsset:{b:p}});driver.tick(100);expect(w.current.postMessage).toHaveBeenCalledOnce();
    useBodyState.setState({draft:{assetId:'a',value:p}});driver.tick(150);expect(w.frame.fullness).toBe(sampleBody(p).fullness);
    w.reply();driver.tick(200);useBodyState.setState({draft:{assetId:'a',value:{...p,left:.3}}});driver.tick(250);expect(w.current.postMessage).toHaveBeenCalledTimes(2);
    useBodyState.setState({draft:{assetId:'a',value:{...p,lactating:true}}});driver.tick(300);expect(w.frame).toMatchObject({lactating:true,left:.2,right:.8,time:0});
    const stale=w.reply();useBodyState.setState({draft:null});driver.tick(350);expect(stale.close).toHaveBeenCalledOnce();
    expect(w.frame).toMatchObject({left:0,right:0,fullness:0});expect(upload).toHaveBeenCalledTimes(2);
    const late=w.current.onmessage!;driver.dispose();const b={close:vi.fn()};late({data:{bitmap:b}});expect(b.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledTimes(2);
  }finally{driver.dispose();}
});

it('does not let a late labelled cutaway overwrite the external view, even on another actor with the same runtime id',()=>{
  const w=slowWorker(),upload=vi.fn();setBreastView('a',{section:true,labels:true,motion:false});
  const a=breastPainter(canvas(),{assetId:'a',runtimeId:'r'},()=>{},upload);
  try{
    a.tick(0);expect(w.frame).toMatchObject({section:true,labels:true});const bitmap=w.reply();
    setBreastView('a',{section:false});a.tick(50);expect(bitmap.close).toHaveBeenCalledOnce();expect(upload).not.toHaveBeenCalled();
    expect(w.frame).toMatchObject({section:false,labels:false});
  }finally{a.dispose();}
  const b=breastPainter(canvas(),{assetId:'b',runtimeId:'r'},()=>{},upload);
  try{b.tick(0);expect(w.frame).toMatchObject({section:false,labels:false});expect(useBodyState.getState().draft).toBeNull();}finally{b.dispose();}
});

it('displays same-actor results between automatic refill ticks even when each raster takes longer than a tick',()=>{
  const w=slowWorker(),upload=vi.fn();setBreastView('a',{motion:false});
  useBodyState.setState({byAsset:{a:{...DEFAULT_BODY_PROFILE,lactating:true,left:.1,right:1}}});
  const driver=breastPainter(canvas(),{assetId:'a',runtimeId:'r'},()=>{},upload);
  try{driver.tick(0);
    for(let i=1;i<=4;i++){
      advanceLiveBodies(['a'],.3);w.reply();driver.tick(i*300);expect(upload).toHaveBeenCalledTimes(i);
      expect(w.frame.left).toBe(useBodyState.getState().byAsset.a.left);
    }
  }finally{driver.dispose();}
});

it('settles the illustrated lower contour after a manual change, never after cancelling it or merely opening the figure',()=>{
  const w=slowWorker();setBreastView('a',{motion:true});const root={...DEFAULT_BODY_PROFILE};
  useBodyState.setState({draft:{assetId:'a',value:root}});
  const d=breastPainter(canvas(),{assetId:'a',runtimeId:'r'},()=>{},()=>{});
  try{
    d.tick(0);expect(w.frame.settle).toBe(0);w.reply();
    useBodyState.setState({draft:{assetId:'a',value:{...root,fullness:.8}}});d.tick(50);
    let prev=w.frame.settle;expect(prev).toBeGreaterThan(0);expect(w.frame.fullness).toBe(.8);
    for(let t=100;t<=1200;t+=50){w.reply();d.tick(t);expect(w.frame.settle).toBeGreaterThanOrEqual(0);expect(w.frame.settle).toBeLessThanOrEqual(prev);prev=w.frame.settle;}
    expect(prev).toBe(0);useBodyState.setState({draft:null});w.reply();d.tick(1300);expect(w.frame.settle).toBe(0);expect(w.frame.fullness).toBe(0);
  }finally{d.dispose();}
});

it('sends a left debit to the left pole only and drops that transient on cancel',()=>{
  const w=slowWorker();setBreastView('a',{motion:true});const value={...DEFAULT_BODY_PROFILE,lactating:true,left:.8,right:.7};
  useBodyState.setState({byAsset:{a:value},draft:{assetId:'a',value}});
  const d=breastPainter(canvas(),{assetId:'a',runtimeId:'r'},()=>{},()=>{});
  try{d.tick(0);w.reply();
    useBodyState.setState({draft:{assetId:'a',value:{...value,left:.25}}});d.tick(50);
    expect(w.frame.leftSettle).toBeLessThan(0);expect(w.frame).toMatchObject({left:.25,right:.7,rightSettle:0,settle:0});w.reply();
    useBodyState.setState({draft:null});d.tick(100);expect(w.frame).toMatchObject({left:.8,right:.7,leftSettle:0,rightSettle:0,settle:0});
  }finally{d.dispose();}
});
