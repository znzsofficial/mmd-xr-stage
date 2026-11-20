import {expect,it,vi} from 'vitest';
import type {ThreeMmdAnimation} from '@yohawing/three-mmd-loader';
import {createRoomMotionCache} from './roomMotionCache';

const parsed=()=>({} as ThreeMmdAnimation);
it('shares only the same File, caps retained source volume, and clears across sessions',async()=>{
  const parse=vi.fn(async(_f:File)=>parsed()),cache=createRoomMotionCache(parse);
  const a=new File(['a'],'dance.vmd'),b=new File(['b'],'dance.vmd');
  expect(cache.status(a)).toBe('miss');const first=cache.load(a);expect(cache.status(a)).toBe('pending');expect(cache.load(a)).toBe(first);expect(await cache.load(b)).not.toBe(await first);expect(cache.status(a)).toBe('hit');
  const full=new File([new Uint8Array(4*1024*1024)],'full.vmd');await cache.load(full);
  expect(await cache.load(a)).not.toBe(await first);cache.clear();await cache.load(a);expect(parse).toHaveBeenCalledTimes(5);
  const huge=new File([full,'x'],'large.vmd');expect(cache.status(huge)).toBe('oversize');expect(await cache.load(huge)).not.toBe(await cache.load(huge));
});
it('retries failures and ignores obsolete rejection after clear or eviction',async()=>{
  let reject!:(e:Error)=>void;const f=new File(['x'],'f.vmd');const parse=vi.fn(async(_f:File)=>parsed())
    .mockImplementationOnce(()=>new Promise((_,r)=>reject=r)).mockRejectedValueOnce(new Error('parse failed'));
  const cache=createRoomMotionCache(parse),old=cache.load(f);cache.clear();await expect(cache.load(f)).rejects.toThrow('parse failed');
  const valid=cache.load(f);reject(new Error('old'));await expect(old).rejects.toThrow('old');expect(cache.load(f)).toBe(valid);
});
it('evicts by recency even for tiny files',async()=>{
  const cache=createRoomMotionCache(async()=>parsed()),files=Array.from({length:5},(_,i)=>new File(['x'],i+'.vmd'));
  const [a,b]=await Promise.all(files.slice(0,4).map(cache.load));await cache.load(files[0]);await cache.load(files[4]);
  expect(await cache.load(files[0])).toBe(a);expect(await cache.load(files[1])).not.toBe(b);
});
