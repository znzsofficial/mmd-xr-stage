/// <reference types="node" />
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { BufferGeometry, Float32BufferAttribute, Texture } from 'three';
import { afterEach, expect, it, vi } from 'vitest';

const entry=pathToFileURL(createRequire(import.meta.url).resolve('@yohawing/three-mmd-loader/physics'));
const {evaluateMmdTextureAlphaGeometry:scan}=await import(new URL('../three/textures.js',entry).href);

// Give the real loader a readable image surface without depending on a GPU.
// Multiple materials share the SAME image while using disjoint parts of it.
class Atlas {
  complete=true;
  constructor(readonly width:number,readonly height:number,readonly alpha:(x:number,y:number)=>number){}
}
function surface() {
  let reads=0,fail=false;
  vi.stubGlobal('HTMLImageElement',Atlas);
  vi.stubGlobal('document',{createElement:()=>{let img:Atlas;return {getContext:()=>({drawImage:(v:Atlas)=>{img=v;},getImageData:()=>{
    reads++;if(fail)throw Error('image unavailable');
    const data=new Uint8ClampedArray(img.width*img.height*4);for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)data[4*(y*img.width+x)+3]=img.alpha(x,y);
    return {data};}})};}});
  return {count:()=>reads,fail:(v:boolean)=>{fail=v;}};
}
function geometry(){
  const g=new BufferGeometry(),uv:number[]=[];
  // Opaque / cutout / soft-alpha regions plus wrap, reverse winding and a degenerate group.
  for(const [i,[x0,y0,x1,y1,x2,y2]] of [[.01,.02,.24,.02,.01,.55],[.35,.10,.55,.10,.35,.7],[.72,.04,.95,.04,.72,.7],[-.44,-.17,1.13,.92,.73,.19],[1.2,.8,1.2,.8,1.2,.8]].entries()){
    uv.push(x0,y0,x1,y1,x2,y2);g.addGroup(i*3,3,i);
  }
  g.setAttribute('uv',new Float32BufferAttribute(uv,2));return g;
}
const texture=(im:Atlas)=>new Texture(im as unknown as HTMLImageElement);
afterEach(()=>vi.unstubAllGlobals());

it.each([[97,161],[1024,111], [1501,777]])('reads the shared %ix%i atlas once while preserving individual material classifications', (w,h)=>{
  const canvas=surface(), tex=texture(new Atlas(w,h,x=>x<w*.31?255:x<w*.65?(x%7<3?0:255):123));
  const g=geometry(), cache=new Map();
  const baseline=Array.from({length:5},(_,i)=>scan(tex,g,i));const n=canvas.count();
  expect(baseline.slice(0,3)).toEqual(['opaque','alphaTest','alphaBlend']);
  expect(Array.from({length:5},(_,i)=>scan(tex,g,i,{},cache))).toEqual(baseline);
  expect(canvas.count()-n).toBe(1);
});

it('does not confuse fully opaque with an atlas whose sole transparent texel misses the sampling lattice',()=>{
  const c=surface(),g=geometry(),cache=new Map();const white=texture(new Atlas(1024,32,()=>255));
  expect(scan(white,g,0,{},cache)).toBeUndefined();expect(scan(white,g,1,{},cache)).toBeUndefined();expect(c.count()).toBe(1);
  const unused=texture(new Atlas(1024,32,(x,y)=>x===0&&y===0?0:255));expect(scan(unused,g,0,{},cache)).toBe('opaque');
});

it('retries an unreadable source and does not keep results across load passes',()=>{
  const c=surface(),g=geometry(),cache=new Map();let a=125;const tex=texture(new Atlas(32,32,()=>a));
  c.fail(true);expect(scan(tex,g,0,{},cache)).toBeUndefined();c.fail(false);expect(scan(tex,g,1,{},cache)).toBe('alphaBlend');
  a=255;expect(scan(tex,g,0,{},new Map())).toBeUndefined();expect(c.count()).toBe(3);
});
