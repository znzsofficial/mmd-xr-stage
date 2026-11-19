/// <reference types="node" />
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { BufferGeometry, Float32BufferAttribute, Texture, TextureLoader } from 'three';
import {createRoomAlphaTiles} from './roomAlphaTiles';
import { afterEach, expect, it, vi } from 'vitest';

const entry=pathToFileURL(createRequire(import.meta.url).resolve('@yohawing/three-mmd-loader/physics'));
const {evaluateMmdTextureAlphaGeometry:scan,loadMaterialTextureWithDiagnostics:loadDiffuse}=await import(new URL('../three/textures.js',entry).href);

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
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

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

it('uses exact PNG File identity, not material or model name, and retries missing/unreadable images',async()=>{
  const canvas=surface(), cache=createRoomAlphaTiles(), g=geometry();
  const png=new Uint8Array(41);png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);png.set([73,68,65,84],37);
  const original=new File([png],'atlas.png'), replacement=new File([png],'atlas.png');
  let source:File|undefined, alpha=(x:number):number=>x<64?255:125;
  // Replace only the DOM image decoder; the loader still resolves Files, tags
  // their provenance, disposes blob URLs and runs its real UV/material scan.
  vi.spyOn(TextureLoader.prototype,'load').mockImplementation((_url,done)=>{
    const tex=texture(new Atlas(128,128,x=>alpha(x)));done?.(tex);return tex;
  });
  const load=(custom?:TextureLoader)=>loadDiffuse('atlas.png',undefined,'diffuse',0,undefined,{resolve:()=>source},[],custom,new Map());
  const sample=async(tex:Texture,index:number)=>{
    const access=cache.forLoad(()=>false);let pending:Promise<void>|undefined;
    const result=scan(tex,g,index,{localPngAlphaTiles:{get:access.get,set:(...args:Parameters<typeof access.set>)=>{pending=access.set(...args);}}},new Map());
    await pending;return result;
  };
  expect(await load()).toBeUndefined();source=original;
  canvas.fail(true);expect(await sample(await load(),2)).toBeUndefined();canvas.fail(false);
  expect(await sample(await load(),2)).toBe('alphaBlend');
  expect(await sample(await load(),0)).toBe('opaque');expect(canvas.count()).toBe(2);
  source=replacement;alpha=()=>255;
  expect(await sample(await load(),2)).toBeUndefined();expect(canvas.count()).toBe(3);
  expect(await sample(await load(),2)).toBeUndefined();expect(canvas.count()).toBe(3);
  alpha=()=>90;const custom=await load(new TextureLoader());
  expect(await sample(custom,2)).toBe('alphaBlend');expect(custom.userData.mmdTextureOwnership).toBeUndefined();
  cache.clear();expect(await sample(await load(),2)).toBe('alphaBlend');expect(canvas.count()).toBe(5);
});
