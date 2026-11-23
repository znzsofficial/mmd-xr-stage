// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {breastViews,readBreastView} from '../bodyState/breast/view';
import {useBodyState} from '../bodyState/store';
import {defaultPelvicCalibration} from '../pelvic/contract';
import {usePelvic} from '../pelvic/store';
import {ObservationScreenControls} from './ActorObservation';
import {readAtlasView,useAtlasSettings} from '../pelvic/atlas/view';

afterEach(()=>{useBodyState.setState(useBodyState.getInitialState());usePelvic.setState(usePelvic.getInitialState());
  breastViews.setState({actors:{}});useAtlasSettings.setState({actors:{}});
  useLanguageStore.setState(useLanguageStore.getInitialState());vi.restoreAllMocks();vi.unstubAllGlobals();});

it('opens the requested part directly, shows each organ’s own balance, and leaves the simulation and caller’s draft alone on return',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  useLanguageStore.setState({language:'zh'});
  const saved={...DEFAULT_BODY_PROFILE,day:18},draft={assetId:'a',value:{...saved,day:22,lactating:true,left:.25,right:.75}};
  const p={calibration:defaultPelvicCalibration,clothingClear:false,clothed:true,showAdapter:false,container:'vaginal' as const,
    fluid:{vaginal:1.5,fantasyUterine:3},capacity:{vaginal:4,fantasyUterine:16},drained:0,overflow:0,speedHz:1,stroke:.7};
  useBodyState.setState({byAsset:{a:saved},draft});usePelvic.setState({byAsset:{a:p}});
  const body=useBodyState.getState(),pelvis=usePelvic.getState(),onBack=vi.fn();
  const el=document.createElement('div'),root=createRoot(el),button=(text:string)=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent===text)!;
  try{
    await act(async()=>root.render(<ObservationScreenControls assetId="a" runtimeId="r" initialPart="vagina" onBack={onBack} backLabel="返回插入"/>));
    expect(button('阴道').getAttribute('aria-pressed')).toBe('true');expect(el.textContent).toContain('阴道精液1.5 / 4 游戏单位');expect(el.textContent).toContain('无杆位采样');
    expect(el.textContent).toContain('当前预览');expect(el.textContent).toContain('22 / 28');
    for(const name of ['子宫','外阴','乳房']){await act(async()=>button(name).click());
      expect(button(name).getAttribute('aria-pressed')).toBe('true');for(const preset of ['正面','斜面','侧面'])expect(button(preset).closest('details')).toBeNull();
      if(name==='子宫')expect(el.textContent).toContain('宫腔精液3 / 16 游戏单位');}
    expect(el.textContent).toContain('25% / 75%');await act(async()=>button('返回插入').click());expect(onBack).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());}
  expect(useBodyState.getState()).toBe(body);expect(usePelvic.getState()).toBe(pelvis);
});

it('keeps the selected fold geometry with its actor without creating a fit or recording an entry while browsing',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);useLanguageStore.setState({language:'zh'});
  const before=usePelvic.getState(),el=document.createElement('div'),root=createRoot(el);
  const show=(id:string)=>act(async()=>root.render(<ObservationScreenControls assetId={id} runtimeId="r" initialPart="vulva" onBack={()=>{}}/>));
  const click=(label:string)=>act(async()=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent===label)!.click());
  try{await show('a');await click('内缘突出');await click('侧面');await click('阴道');await click('外阴');
    expect(readAtlasView('a').foldStyle).toBe('defined');await show('b');await click('外侧覆盖');
    expect(readAtlasView('a').foldStyle).toBe('defined');expect(readAtlasView('b').foldStyle).toBe('soft');expect(usePelvic.getState()).toBe(before);
  }finally{await act(async()=>root.unmount());}
});

it('remembers the exterior brush by actor through cutaway and re-entry without editing the body profile',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);useLanguageStore.setState({language:'zh'});
  const body=useBodyState.getState(),rootEl=document.createElement('div'),root=createRoot(rootEl);
  const button=(s:string)=>Array.from(rootEl.querySelectorAll('button')).find(b=>b.textContent===s)!;
  const show=(id:string)=>act(async()=>root.render(<ObservationScreenControls assetId={id} runtimeId="r" onBack={()=>{}}/>));
  try{
    await show('a');expect(button('轻柔').getAttribute('aria-pressed')).toBe('true');
    await act(async()=>button('圆隆').click());await act(async()=>button('侧面').click());
    await act(async()=>button('剖面').click());expect(button('圆隆')).toBeUndefined();expect(button('结构标注')).toBeDefined();
    await act(async()=>button('剖面').click());expect(button('圆隆').getAttribute('aria-pressed')).toBe('true');
    await show('b');expect(button('轻柔').getAttribute('aria-pressed')).toBe('true');expect(button('正面').getAttribute('aria-pressed')).toBe('true');
    await show('a');expect(button('圆隆').getAttribute('aria-pressed')).toBe('true');expect(button('侧面').getAttribute('aria-pressed')).toBe('true');
    expect(readBreastView('b').areolaStyle).toBe('soft');expect(useBodyState.getState()).toBe(body);
  }finally{await act(async()=>root.unmount());}
});

it('keeps a fresh actor’s loading message until the current part actually paints; a retired worker cannot clear it',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);useLanguageStore.setState({language:'zh'});
  const queue=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{queue.set(++id,f);return id;});vi.stubGlobal('cancelAnimationFrame',(i:number)=>queue.delete(i));
  const frame=async(t:number)=>act(async()=>{const fs=[...queue.values()];queue.clear();fs.forEach(f=>f(t));});
  const workers:Stub[]=[];class Stub{constructor(){workers.push(this);}onmessage?:Function;postMessage=vi.fn();terminate=vi.fn();}
  vi.stubGlobal('Worker',Stub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({},{get:()=>()=>{}}) as CanvasRenderingContext2D);
  const el=document.createElement('div'),root=createRoot(el);const busy=()=>el.querySelector('.observation-art')?.getAttribute('aria-busy');
  try{
    await act(async()=>root.render(<ObservationScreenControls assetId="a" runtimeId="r" onBack={()=>{}}/>));await frame(0);
    const late=workers[0].onmessage!;await act(async()=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='子宫')!.click());await frame(40);
    const stale={close:vi.fn()};late({data:{bitmap:stale}});expect(stale.close).toHaveBeenCalledOnce();expect(busy()).toBe('true');
    workers[1].onmessage!({data:{bitmap:{close:vi.fn()}}});expect(busy()).toBe('true');await frame(80);
    expect(busy()).toBe('false');expect(el.querySelector('canvas')?.dataset.view).toBe('uterus');expect(el.querySelector('.observation-loading')).toBeNull();
    expect(usePelvic.getState().byAsset).toEqual({});expect(useBodyState.getState()).toMatchObject({byAsset:{},draft:null});
  }finally{await act(async()=>root.unmount());}
});
