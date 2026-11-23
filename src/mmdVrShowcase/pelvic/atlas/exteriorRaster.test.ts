import {afterEach,expect,it,vi} from 'vitest';
import {restingCut} from '../vulvaForm';
import {drawVulva} from './vulvaSurface';

afterEach(()=>vi.unstubAllGlobals());

it('fits a reused mutable measurement, caches a stationary pose, and rerasterizes only across actual pixel tiers',()=>{
  let pixels=new Uint8ClampedArray(),uploads=0,scale=.83;
  const tile={width:0,height:0,getContext:()=>({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:(img:{data:Uint8ClampedArray})=>{pixels=img.data.slice();uploads++;}})};
  vi.stubGlobal('OffscreenCanvas',undefined);vi.stubGlobal('document',{createElement:()=>tile});
  const ctx={getTransform:()=>({a:scale,b:0,c:0,d:scale}),drawImage:()=>{}} as unknown as CanvasRenderingContext2D;
  const cut={...restingCut};const draw=(angle=-.60)=>drawVulva(ctx,angle,cut,'natural','elastic');
  draw();const rest=Buffer.from(pixels),isRest=()=>rest.equals(Buffer.from(pixels));expect([tile.width,tile.height]).toEqual([324,356]);
  for(let i=0;i<8;i++)draw();expect(uploads).toBe(1);
  cut.xx=.28;cut.x=-.19;draw();expect(uploads).toBe(2);expect(isRest()).toBe(false);
  Object.assign(cut,restingCut);draw();expect(isRest()).toBe(true);
  scale=3.1;draw();expect([tile.width,tile.height]).toEqual([567,623]);const n=uploads;
  scale=3.45;draw();expect(uploads).toBe(n);
  scale=20;draw();expect([tile.width,tile.height]).toEqual([648,712]);
  scale=.83;draw(1.41);draw();expect(isRest()).toBe(true);
});
