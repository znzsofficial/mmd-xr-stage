import {afterEach,expect,it,vi} from 'vitest';
import {Matrix4} from 'three';
import {pelvicRailMatrix} from '../path';
import {createPelvicSolver} from '../solver';
import type {PelvicSample} from '../stateTypes';
import {REFERENCE_TISSUE} from '../../bodyState/data';
import {createCanalContact} from './canalContact';
import {ENTRY,STOP,stride,type V} from './model';
import {createOverviewTract} from './overviewTract';
import {createOrganArt,type OrganArtOptions} from './organArt';

// The stand crosses from outside in 1 mm steps. The measured frame comes
// from the production solver (including lateral offset and the curved tip).
function run(offset=.002){
  const f={world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.024,lengthM:.092},solver=createPelvicSolver();
  let mm=-21;
  function frame():PelvicSample{const m=pelvicRailMatrix(f,mm/1000);m.elements[12]+=offset;
    const c=solver.step(f,m,{dt:1/72});return {shaft:c.shaftLocal.map(v=>v.toArray()),tip:c.outletLocal.toArray(),tail:c.shaftLocal[0].toArray(),
      depth:c.depthM,radiusM:f.radiusM,lengthM:f.lengthM,aligned:c.inside,outletInside:c.outletInside,outletVisible:c.outletVisible,atCervix:c.atCervix,angleDeg:0};}
  return (target:number)=>{let s=frame();while(mm!==target){mm+=Math.sign(target-mm);s=frame();}return s;};
}
afterEach(()=>vi.unstubAllGlobals());

it('opens the cut walls only along the admitted rows, including asymmetric fits, and releases them from the deep end',()=>{
  const fit=createCanalContact(),tract=createOverviewTract(),pose=run(),angle=-.27;
  const rest=tract.prepare(angle,fit),range=(a:Float32Array,min:number,max:number)=>{
    let displacement=0;for(let i=0;i<a.length;i+=stride){const t=(rest[i+2]-ENTRY)/(STOP-ENTRY);if(t>=min&&t<=max)
      displacement=Math.max(displacement,Math.hypot(a[i]-rest[i],a[i+1]-rest[i+1]));}return displacement;};
  function impression(mm:number){fit.update(pose(mm));return tract.prepare(angle,fit);}
  const deep=impression(62).slice();expect(range(deep,.38,.54)).toBeGreaterThan(.21);expect(range(deep,.72,1.29)).toBe(0);
  expect(tract.tipZ).toBeCloseTo(ENTRY+(STOP-ENTRY)*62/92,5);
  const shallow=impression(22);expect(range(shallow,.06,.18)).toBeGreaterThan(.12);expect(range(shallow,.29,1.29)).toBe(0);
  fit.update(run(-.002)(62));const left=tract.prepare(angle,fit);
  let matched=0;for(let i=0;i<deep.length;i+=stride)if(deep[i]-left[i]>.075)matched++;
  expect(matched).toBeGreaterThan(50);expect(impression(-9)).toBe(rest);
});

function raster(){
  let pixels=new Uint8ClampedArray(0),puts=0;
  vi.stubGlobal('OffscreenCanvas',class {getContext(){return {createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:(img:ImageData)=>{pixels=img.data.slice();puts++;}};}});
  const ctx=new Proxy({getTransform:()=>({a:1,b:0,c:0,d:1}),measureText:()=>({width:18})},{get:(o,k)=>Reflect.get(o,k)??(()=>{}),set:()=>true}) as unknown as CanvasRenderingContext2D;
  const art=createOrganArt();return {art,get puts(){return puts;},draw(o:OrganArtOptions){art.draw(ctx,o);return pixels;}};
}
const changed=(a:Uint8ClampedArray,b:Uint8ClampedArray,w:number,lo=0,hi=a.length/(4*w))=>{
  let n=0;for(let i=Math.floor(lo)*w*4;i<Math.floor(hi)*w*4;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;return n;
};
const silicone=(p:Uint8ClampedArray,i:number)=>p[i+2]>p[i]+1&&p[i+2]>p[i+1]+26;

it.each([0,38,70,83,-83,90])('shows volume and tissue in the 156px full plate at %i°, without moving the cavity or rendering a parked/stale tip',degrees=>{
  const w=156,h=128,r=raster(),pose=run();
  const o:OrganArtOptions={x:0,y:0,width:w,height:h,yaw:degrees*Math.PI/180,time:0,lining:.44,shedding:0,pressure:0,zh:false,
    tissue:REFERENCE_TISSUE,fluid:0,fantasy:false,focus:'uterus'};
  const draw=(s:PelvicSample|null,more?:Partial<OrganArtOptions>)=>r.draw({...o,sample:s,...more});
  try{
    const rest=draw(pose(-9)),s=pose(62),deep=draw(s),before=r.puts;
    draw({...s,depth:.001},{pressure:1,time:14});expect(r.puts).toBe(before);
    const shallow=draw(pose(22));expect(changed(rest,deep,w,0,85)).toBe(0);
    expect(changed(rest,deep,w,96,106)).toBeGreaterThan(30);expect(changed(rest,shallow,w,96,106)).toBe(0);
    expect(changed(rest,shallow,w,110,119)).toBeGreaterThan(10);
    // A pencil-thin line or dot cannot make a contiguous, shaded material
    // cross section. Compare rest vs engaged silhouette separately from this.
    let width=0,range=0,wallPixels=0;
    for(let y=96;y<115;y++){let run=0,min=255,max=0;for(let x=45;x<113;x++){
      const i=(w*y+x)*4;if(silicone(deep,i)){run++;min=Math.min(min,deep[i]);max=Math.max(max,deep[i]);width=Math.max(width,run);range=Math.max(range,max-min);}
      else {run=0;min=255;max=0;if(deep[i]>90&&rest[i]===33)wallPixels++;}
    }}
    expect(width).toBeGreaterThanOrEqual(4);expect(range).toBeGreaterThan(11);expect(wallPixels).toBeGreaterThan(8);
    // Look *inside* the geometric silhouette of actual mid-shaft rings.
    // Part must be silicone and part warm tissue: a shaft superimposed on
    // top of the whole organ cannot satisfy this occlusion check.
    const fit=createCanalContact();fit.update(s);let covered=0,exposed=0;
    fit.rings((r,z,x,y,rx,ry,shear)=>{if(r<8||r>35||r%4)return;
      const sa=Math.sin(-o.yaw),ca=Math.cos(o.yaw),pitch=.095*Math.abs(ca),k=Math.min(w*.91/11.99,h*.88/8.78);
      const cx=w*.5+k*(.37*sa+ca*x-sa*y),row=Math.round(h*.5+k*(.45-z*Math.cos(pitch)+(sa*x+ca*y)*Math.sin(pitch)));
      const half=k*Math.hypot(rx*(ca-sa*shear),ry*sa);
      for(let col=Math.ceil(cx-half);col<=Math.floor(cx+half);col++){const i=4*(row*w+col);
        if(deep[i]-deep[i+2]>25)covered++;if(silicone(deep,i))exposed++;}
    });expect(covered).toBeGreaterThan(0);expect(exposed).toBeGreaterThan(2);
    const stop=pose(92);expect(stop.atCervix&&stop.outletInside).toBe(true);const noPress=draw({...stop,atCervix:false}),hit=draw(stop);
    expect(changed(noPress,hit,w,0,81)).toBe(0);expect(changed(noPress,hit,w,81,96)).toBeGreaterThan(0);
    expect(changed(deep,draw({...s,atCervix:true}),w)).toBe(0);
    const overrun=(p:readonly number[]):V=>[p[0],p[1],p[2]-.005];
    const pastStop={...stop,tip:overrun(stop.tip),shaft:stop.shaft!.map(overrun)};
    for(const [sample,parked] of [[s,true],[{...s,outletInside:false},false],[{...s,shaft:undefined},false],[pastStop,false],[null,false]] as const){
      expect(changed(rest,draw(sample,{parked,time:23,pressure:1}),w)).toBe(0);
    }
    const fill=draw(null,{uterineFluid:.6}),wet=draw(s,{uterineFluid:.6});
    expect(changed(rest,fill,w,0,85)).toBeGreaterThan(10);expect(changed(fill,wet,w,0,85)).toBe(0);expect(changed(deep,wet,w,94,128)).toBe(0);
  }finally{r.art.dispose();}
});
