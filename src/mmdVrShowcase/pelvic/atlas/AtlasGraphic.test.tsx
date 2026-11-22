// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useBodyState} from '../../bodyState/store';
import {DEFAULT_BODY_PROFILE} from '../../bodyState/data';
import {AtlasScreenGraphic} from './AtlasGraphic';
import {readAtlasView,setAtlasView,useAtlasSettings} from './view';

it('isolates a captured drag, painted pixels and late bitmaps across actor changes and StrictMode cleanup',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const frames=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});
  vi.stubGlobal('cancelAnimationFrame',(key:number)=>frames.delete(key));
  function frame(t:number){const cbs=[...frames.values()];frames.clear();for(const cb of cbs)cb(t);}
  const workers:Stub[]=[];
  class Stub{constructor(){workers.push(this);}postMessage=vi.fn();terminate=vi.fn();onmessage?:Function;}
  vi.stubGlobal('Worker',Stub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true}) as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);
  const host=document.createElement('div'),root=createRoot(host);let mounted=true;
  const day={...DEFAULT_BODY_PROFILE};useBodyState.setState({byAsset:{a:day,b:{...day,day:18}}});
  setAtlasView('a',{motion:false,degrees:0});setAtlasView('b',{motion:false,degrees:90});
  const show=async(assetId:string)=>{await act(async()=>root.render(<StrictMode><AtlasScreenGraphic assetId={assetId} runtimeId={assetId} scope="body"/></StrictMode>));return host.querySelector('canvas')!;};
  function pointer(el:HTMLCanvasElement,type:string,x:number){el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:3,clientX:x,button:0}));}
  try{
    const a=await show('a');expect(frames.size).toBe(1);frame(0);expect(workers).toHaveLength(1);
    const deliver=workers[0].onmessage!;const first={close:vi.fn()};deliver({data:{bitmap:first}});frame(20);
    expect(a.dataset.angle).toBe('0');expect(first.close).toHaveBeenCalledOnce();
    a.setPointerCapture=vi.fn();pointer(a,'pointerdown',12);setAtlasView('a',{degrees:10});frame(40);
    const b=await show('b');expect(workers[0].terminate).toHaveBeenCalledOnce();expect(b).not.toBe(a);expect(b.hasAttribute('aria-label')).toBe(false);
    pointer(b,'pointermove',70);expect(readAtlasView('b').degrees).toBe(90);
    const late={close:vi.fn()};deliver({data:{bitmap:late}});expect(late.close).toHaveBeenCalledOnce();
    frame(55);expect(workers).toHaveLength(2);const pending={close:vi.fn()};workers[1].onmessage!({data:{bitmap:pending}});
    await act(async()=>root.unmount());mounted=false;
    expect(workers[1].terminate).toHaveBeenCalledOnce();expect(pending.close).toHaveBeenCalledOnce();expect(frames.size).toBe(0);
  }finally{
    if(mounted)await act(async()=>root.unmount());useBodyState.setState(useBodyState.getInitialState());useAtlasSettings.setState({actors:{}});
    vi.restoreAllMocks();vi.unstubAllGlobals();
  }
});
