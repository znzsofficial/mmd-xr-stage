import {expect,it} from 'vitest';
import {createRoomAlphaTiles} from './roomAlphaTiles';

const pngHeader=(chunk='IDAT')=>{
  const bytes=new Uint8Array(48);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);bytes.set(new TextEncoder().encode(chunk),37);return bytes;
};
it('bounds storage, distinguishes opacity from a miss, and rejects retired writes after a clear',async()=>{
  const files=Array.from({length:10},()=>new File([pngHeader()],'same.png'));
  let stale=false;
  const cache=createRoomAlphaTiles(), load=cache.forLoad(()=>stale);
  for(const file of files.slice(0,8)) await load.set(file,400,400,null);
  expect(load.get(files[0],400,400)).toBeNull();await load.set(files[8],400,400,null);
  expect(load.get(files[1],400,400)).toBeUndefined();expect(load.get(files[0],400,800)).toBeUndefined();
  stale=true;load.set(files[9],400,400,null);stale=false;expect(load.get(files[9],400,400)).toBeUndefined();
  const pending=load.set(files[0],400,400,null);cache.clear();await pending;await load.set(files[0],400,400,null);
  expect(cache.forLoad(()=>false).get(files[0],400,400)).toBeUndefined();
});
it('never reuses animated, misnamed or inconclusive PNG sources',async()=>{
  const load=createRoomAlphaTiles().forLoad(()=>false);
  for(const data of [pngHeader('acTL'),new Uint8Array([1]),pngHeader('iTXt')]){
    const file=new File([data],'x.png');await load.set(file,1,1,null);expect(load.get(file,1,1)).toBeUndefined();
  }
});
