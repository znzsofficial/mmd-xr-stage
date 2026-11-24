// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {useBodyState} from '../bodyState/store';
import {DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {useConception} from '../bodyState/reproduction/store';
import {breastViews,readBreastView} from '../bodyState/breast/view';
import {defaultPelvicCalibration} from '../pelvic/contract';
import {readAtlasView,setAtlasView,useAtlasSettings} from '../pelvic/atlas/view';
import {usePelvic,type PelvicSample} from '../pelvic/store';
import {ObservationScreenControls} from './ActorObservation';
import {LivePelvicScreenView} from './LivePelvicView';
import {tractContexts} from './reference/tractContext';
import {createReferenceBook} from './reference/diagrams';

afterEach(()=>{useBodyState.setState(useBodyState.getInitialState());useConception.setState(useConception.getInitialState());usePelvic.setState(usePelvic.getInitialState());
  useAtlasSettings.setState({actors:{}});breastViews.setState({actors:{}});useLanguageStore.setState(useLanguageStore.getInitialState());
  vi.restoreAllMocks();vi.unstubAllGlobals();});

function surface(){
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);useLanguageStore.setState({language:'zh'});
  const frames=new Map<number,FrameRequestCallback>();let seq=0;
  vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++seq,f);return seq;});vi.stubGlobal('cancelAnimationFrame',(i:number)=>frames.delete(i));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({},{get:()=>()=>{}}) as CanvasRenderingContext2D);
  const workers:WorkerStub[]=[];
  class WorkerStub{constructor(){workers.push(this);}onmessage?:Function;postMessage=vi.fn();terminate=vi.fn();}
  vi.stubGlobal('Worker',WorkerStub);vi.stubGlobal('OffscreenCanvas',class{transferToImageBitmap(){}});
  const frame=(now:number)=>act(()=>{const fs=[...frames.values()];frames.clear();fs.forEach(f=>f(now));});
  return {workers,frame};
}

it('keeps one choice across parts, isolates insertion and keeps the reference off a fresh or reopened actor',async()=>{
  const {workers,frame}=surface(),host=document.createElement('div'),root=createRoot(host);
  const event={id:1,at:-20000,chance:100,success:true,side:-1 as const};
  useConception.setState({byAsset:{a:{chance:100,eggs:[{id:1,side:-1,fertilized:true,event}],event}}});
  const saved={...DEFAULT_BODY_PROFILE,lactating:true,left:.13,right:.68};useBodyState.setState({byAsset:{a:saved},draft:{assetId:'a',value:{...saved,left:1}}});
  const body=useBodyState.getState(),pelvis=usePelvic.getState(),eggs=useConception.getState();
  const show=(id:string,observe=true)=>act(()=>root.render(<><LivePelvicScreenView assetId={id} runtimeId="r" blocked/>{observe&&<ObservationScreenControls assetId={id} runtimeId="r" onBack={()=>{}}/>}</>));
  const sheet=()=>host.querySelector('.actor-observation')!,monitor=()=>host.querySelector('.live-pelvic-view')!;
  const btn=(s:string)=>[...sheet().querySelectorAll('button')].find(b=>b.textContent===s)!,click=(s:string)=>act(()=>btn(s).click());
  let clock=0;
  async function painted(id:string){await frame(clock+=100);for(const w of workers)if(w.postMessage.mock.calls.length&&!w.terminate.mock.calls.length)w.onmessage?.({data:{bitmap:{close(){}}}});
    await frame(clock+=100);expect(sheet().querySelector('canvas')?.dataset.view).toBe(id);expect(monitor().querySelector('canvas')?.dataset.view).toBe('uterus');}
  try{
    await show('a');expect(btn('日常观察').getAttribute('aria-pressed')).toBe('true');await click('孕态参考');await painted('reference-breast');
    expect(sheet().textContent).toContain('角色乳量（左 / 右）13% / 68%');await click('侧面');await click('剖面');await painted('reference-breast');
    expect(sheet().querySelector('canvas')?.dataset).toMatchObject({angle:'90',section:'true'});
    expect(readBreastView('a').section).toBe(false);await click('子宫');await click('结构标注');await painted('reference-uterus');expect(sheet().textContent).not.toContain('已受精');expect(readAtlasView('a').labels).toBe(false);
    expect(monitor().textContent).not.toContain('孕态参考');expect(monitor().textContent).toContain('已受精');
    await click('阴道');await painted('reference-context-vagina');await click('外阴');await painted('reference-context-vulva');
    await click('卵子');await painted('egg');expect(sheet().textContent).toContain('角色卵子记录');expect(sheet().textContent).toContain('已受精');expect(btn('强制排卵')).toBeUndefined();
    await click('子宫');expect(btn('孕态参考').getAttribute('aria-pressed')).toBe('true');await click('日常观察');await painted('uterus');
    await click('孕态参考');await show('a',false);await show('a');expect(btn('日常观察').getAttribute('aria-pressed')).toBe('true');
    await click('孕态参考');await show('b');expect(btn('日常观察').getAttribute('aria-pressed')).toBe('true');await click('孕态参考');await click('卵子');await painted('egg');expect(sheet().textContent).toContain('0 / 3');
    expect(useConception.getState()).toBe(eggs);expect(usePelvic.getState()).toBe(pelvis);expect(useBodyState.getState()).toBe(body);
  }finally{await act(()=>root.unmount());}
});

it.each(['vagina','vulva'] as const)('pairs the %s map with the painted angle and the real current sample, including loss of contact',part=>{
  const {workers}=surface(),canvas=document.createElement('canvas'),spec=tractContexts[part],upload=vi.fn();canvas.width=spec.width*2;canvas.height=spec.height*2;
  const sample:PelvicSample={tip:[0,0,.04],tail:[0,0,-.04],radiusM:.019,lengthM:.1,depth:.04,outletInside:true,atCervix:false,aligned:true,angleDeg:0};
  usePelvic.setState({byAsset:{a:{calibration:defaultPelvicCalibration,showAdapter:false,clothingClear:false,clothed:true,speedHz:1,stroke:.7,container:'vaginal',
    fluid:{vaginal:2,fantasyUterine:0},capacity:{vaginal:4,fantasyUterine:16},overflow:0,drained:0}},active:{assetId:'a',runtimeId:'r',mode:'standAuto',source:'xr',token:3,running:true,awaitingWorld:false,position:.9},sample});
  setAtlasView('a',{degrees:0,motion:true});const painter=spec.open(canvas,{assetId:'a',runtimeId:'r'},()=>{},upload);
  const options=()=>workers[0].postMessage.mock.lastCall![0].options,deliver=()=>workers[0].onmessage!({data:{bitmap:{close(){}}}});
  try{
    painter.tick(0);expect(options()).toMatchObject({focus:part,sample,vaginalFluid:.5});setAtlasView('a',{degrees:90});deliver();painter.tick(40);
    expect(canvas.dataset.angle).toBe('0');const pending=options().yaw*180/Math.PI;expect(pending).toBeGreaterThan(0);expect(pending).toBeLessThan(90);
    deliver();painter.tick(80);expect(Number(canvas.dataset.angle)).toBe(Math.round(pending));expect(workers).toHaveLength(1);
    usePelvic.setState({sample:null});setAtlasView('a',{degrees:38,motion:false});deliver();painter.tick(120);
    expect(options()).toMatchObject({sample:null,pressure:0,vaginalFluid:.5});deliver();painter.tick(160);expect(canvas.dataset.angle).toBe('38');
    upload.mockClear();painter.tick(6000);expect(upload).not.toHaveBeenCalled();expect(usePelvic.getState().active?.position).toBe(.9);
  }finally{painter.dispose();}
});

it.each(['uterus','breast'] as const)('holds the %s reference through elapsed time and actor ledger changes; no bitmap is published after exit',part=>{
  const {workers}=surface(),spec=createReferenceBook()[part],upload=vi.fn(),canvas=document.createElement('canvas');canvas.width=spec.width*2;canvas.height=spec.height*2;
  const painter=spec.open(canvas,{assetId:'a',runtimeId:'r'},()=>{},upload);painter.tick(0);
  const worker=workers[0],reply=worker.onmessage!,send=()=>{const bitmap={close:vi.fn()};reply({data:{bitmap}});return bitmap;};
  const first=send();painter.tick(50);expect(first.close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
  useBodyState.setState({byAsset:{a:{...DEFAULT_BODY_PROFILE,lactating:true,left:.78,right:.12}}});
  useConception.setState({byAsset:{a:{chance:80,eggs:[{id:1,side:1,fertilized:true}]}}});
  for(const now of [1000,2000,30000])expect(painter.tick(now)).toBe(false);
  expect(worker.postMessage).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();
  spec.turn('a',-67);painter.tick(30100);expect(worker.postMessage).toHaveBeenCalledTimes(2);painter.dispose();
  expect(send().close).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();
});
