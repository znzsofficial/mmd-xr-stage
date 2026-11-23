// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useConception,type ConceptionEvent} from '../../bodyState/reproduction/store';
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
  const drawImage=vi.fn(),ctx=new Proxy({}, {get:(_,key)=>key==='drawImage'?drawImage:()=>{},set:()=>true}) as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);
  const host=document.createElement('div'),root=createRoot(host);let mounted=true;
  const event:ConceptionEvent={id:1,success:false,chance:20,at:0,side:-1};useConception.setState({byAsset:{a:{chance:80,event,eggs:[{id:1,fertilized:false,side:-1,event}]}}});
  setAtlasView('a',{motion:false,degrees:0});setAtlasView('b',{motion:false,degrees:90});
  const show=async(assetId:string)=>{await act(async()=>root.render(<StrictMode><AtlasScreenGraphic assetId={assetId} runtimeId={assetId} scope="uterus"/></StrictMode>));return host.querySelector('canvas')!;};
  function pointer(el:HTMLCanvasElement,type:string,x:number){el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:3,clientX:x,button:0}));}
  try{
    const a=await show('a');expect(frames.size).toBe(1);frame(0);expect(workers).toHaveLength(1);
    expect(workers[0].postMessage.mock.lastCall![0].options).toMatchObject({event,yaw:0});
    const deliver=workers[0].onmessage!;const first={close:vi.fn()};deliver({data:{bitmap:first}});frame(20);
    expect(a.dataset.angle).toBe('0');expect(first.close).toHaveBeenCalledOnce();expect(drawImage.mock.lastCall![0]).toBe(first);
    Object.defineProperty(a,'clientWidth',{value:360});a.setPointerCapture=vi.fn();pointer(a,'pointerdown',12);pointer(a,'pointermove',32);
    expect(readAtlasView('a').degrees).toBe(10);frame(40);
    const b=await show('b');expect(workers[0].terminate).toHaveBeenCalledOnce();expect(b).not.toBe(a);expect(b.hasAttribute('aria-label')).toBe(false);
    pointer(b,'pointermove',-70);expect(readAtlasView('b').degrees).toBe(90);
    const late={close:vi.fn()};deliver({data:{bitmap:late}});expect(late.close).toHaveBeenCalledOnce();
    frame(55);expect(workers).toHaveLength(2);const options=workers[1].postMessage.mock.lastCall![0].options;
    expect(options.yaw).toBe(Math.PI/2);expect(options.event).toBeUndefined();
    const pending={close:vi.fn()};workers[1].onmessage!({data:{bitmap:pending}});
    await act(async()=>root.unmount());mounted=false;
    expect(workers[1].terminate).toHaveBeenCalledOnce();expect(pending.close).toHaveBeenCalledOnce();expect(frames.size).toBe(0);expect(drawImage).toHaveBeenCalledOnce();
  }finally{
    if(mounted)await act(async()=>root.unmount());useConception.setState(useConception.getInitialState());useAtlasSettings.setState({actors:{}});
    vi.restoreAllMocks();vi.unstubAllGlobals();
  }
});
