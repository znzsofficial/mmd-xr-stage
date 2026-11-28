import {RepeatWrapping,SRGBColorSpace,Texture,TextureLoader} from 'three';
import {expect,it,vi} from 'vitest';
import {coastalPrint} from './coastalPrints';

it('shares a pending print, releases it with its last use and ignores a retired decode',()=>{
  const requests:{texture:Texture;complete:()=>void;fail:()=>void}[]=[];
  const load=vi.spyOn(TextureLoader.prototype,'load').mockImplementation((_url,onLoad,_progress,onError)=>{
    const texture=new Texture<HTMLImageElement>();vi.spyOn(texture,'dispose');
    requests.push({texture,complete:()=>onLoad?.(texture),fail:()=>onError?.(Error('bad image'))});return texture;
  });
  try {
    const print=coastalPrint('pavement',true),a=vi.fn(),b=vi.fn();
    const leaveA=print.subscribe(a),leaveB=print.subscribe(b);leaveA();
    expect(requests).toHaveLength(1);expect(print.snapshot()).toBeNull();requests[0].complete();
    expect(a).not.toHaveBeenCalled();expect(b).toHaveBeenCalledOnce();
    expect(print.snapshot()).toBe(requests[0].texture);
    expect(print.snapshot()).toMatchObject({wrapS:RepeatWrapping,wrapT:RepeatWrapping,colorSpace:SRGBColorSpace});
    leaveB();expect(requests[0].texture.dispose).toHaveBeenCalledOnce();
    print.subscribe(a)();const leave=print.subscribe(b);requests[1].complete();
    expect(print.snapshot()).toBeNull();requests[2].fail();expect(print.snapshot()).toBeNull();
    const retry=print.subscribe(a);requests[3].complete();expect(print.snapshot()).toBe(requests[3].texture);
    leave();expect(requests[3].texture.dispose).not.toHaveBeenCalled();retry();expect(print.snapshot()).toBeNull();
  } finally {load.mockRestore();}
});
