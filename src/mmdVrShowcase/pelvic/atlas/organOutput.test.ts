import {afterEach,expect,it,vi} from 'vitest';
import {organOutput} from './organOutput';
import type {OrganArtOptions} from './organArt';

const art=vi.hoisted(()=>({draw:vi.fn(),dispose:vi.fn()}));
vi.mock('./organArt',()=>({createOrganArt:()=>art}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});

it('drops intermediate views behind a slow worker and can still paint the latest pose on a device that fails to start it',()=>{
  let worker:WorkerStub|undefined;
  class WorkerStub{constructor(){worker=this;}postMessage=vi.fn();terminate=vi.fn();onmessage?:Function;onerror?:Function;}
  vi.stubGlobal('Worker',WorkerStub);vi.stubGlobal('OffscreenCanvas',class {transferToImageBitmap(){}});
  const out=organOutput(),context={drawImage:vi.fn()} as unknown as CanvasRenderingContext2D;
  function input(yaw:number){return {options:{x:0,y:0,width:344,height:250,yaw,time:1,lining:.5,shedding:0,pressure:0,zh:true,fluid:0,fantasy:false} as OrganArtOptions,
    scale:2,paint:vi.fn((draw:(c:CanvasRenderingContext2D)=>void)=>draw(context))};}
  const first=input(0),middle=input(.3),latest=input(.66);out.submit(first);out.submit(middle);out.submit(latest);
  expect(worker!.postMessage).toHaveBeenCalledTimes(1);const bitmap={close:vi.fn()};worker!.onmessage!({data:{bitmap}});
  expect(bitmap.close).toHaveBeenCalledOnce();expect(first.paint).toHaveBeenCalledOnce();expect(middle.paint).not.toHaveBeenCalled();
  expect(worker!.postMessage.mock.lastCall![0].options.yaw).toBe(.66);
  worker!.onerror!({preventDefault(){}});expect(art.draw).toHaveBeenCalledWith(context,latest.options);
  expect(worker!.terminate).toHaveBeenCalledOnce();out.dispose();expect(art.dispose).toHaveBeenCalledOnce();
});
