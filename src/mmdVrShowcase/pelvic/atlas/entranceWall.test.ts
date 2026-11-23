import {expect,it} from 'vitest';
import {Matrix4} from 'three';
import {pelvicRailMatrix} from '../path';
import {createPelvicSolver} from '../solver';
import {pelvicSeal} from '../geometry';
import {rimSamples} from '../vulvaForm';
import type {PelvicSample} from '../stateTypes';
import {observedCut} from './exteriorStudy';
import {createEntranceWall,entranceBrush,entranceLoad} from './entranceWall';
import {exteriorBrush} from './foldLight';

const frame={world:new Matrix4(),inverse:new Matrix4(),lengthM:.09,radiusM:.024,scale:1},input={dt:1/72,blocked:false};
function stroke(shift=0,tilt=0){
  const solver=createPelvicSolver();let station=-25;
  function step(mm:number){
    const m=pelvicRailMatrix(frame,mm/1000).premultiply(new Matrix4().makeRotationY(tilt));m.elements[12]+=shift;
    return solver.step(frame,m,input);
  }
  step(station);
  return (mm:number)=>{
    while(station!==mm)step(station+=Math.sign(mm-station));
    const c=step(station),s:PelvicSample={tip:c.outletLocal.toArray(),tail:c.shaftLocal[0].toArray(),shaft:c.shaftLocal.map(p=>p.toArray()),
      depth:c.depthM,outletInside:c.outletInside,outletVisible:c.outletVisible,atCervix:c.atCervix,aligned:true,angleDeg:0,radiusM:frame.radiusM,lengthM:frame.lengthM};
    return {s,c};
  };
}

it('stitches a receding, folded surface to every vertex of an off-centre oblique shaft cut',()=>{
  const {c,s}=stroke(.003,.09)(39),cut=observedCut(s),load=entranceLoad(s,cut),wall=createEntranceWall(),lip=pelvicSeal(frame,c,true)!.lip;
  expect(s.outletInside).toBe(true);expect(Math.abs(load.dx)).toBeGreaterThan(.045);expect(load.girth).toBeGreaterThan(.5);
  expect(entranceLoad({...s,depth:0},cut)).toEqual(load);
  wall.fit(cut,load);const a=wall.xyz,rows=a.length/(3*rimSamples),at=(row:number,i:number)=>3*(row*rimSamples+i);
  for(let i=0;i<rimSamples;i++){
    const j=at(0,i);expect(Math.hypot(a[j]*frame.radiusM-lip[i].x,a[j+1]*frame.radiusM-lip[i].y,a[j+2])).toBeLessThan(1e-7);
  }
  const widths:number[]=[],slopes:number[]=[];
  for(let row=0;row<rows;row++){
    const bottom=at(row,3*rimSamples/4),top=at(row,rimSamples/4),z=a[bottom+2];widths.push(a[top+1]-a[bottom+1]);
    if(!row)continue;
    const prev=at(row-1,3*rimSamples/4);expect(z).toBeLessThan(a[prev+2]);
    slopes.push((a[bottom+1]-a[prev+1])/(a[prev+2]-z));
  }
  expect(widths[0]).toBeGreaterThan(1.2);expect(Math.abs(widths.at(-1)!)).toBeLessThan(1e-5);
  // Several distinct crests on the receding bed, not a smooth conical loft.
  const turns=slopes.filter((v,i)=>v>1&&v>slopes[i-1]&&v>slopes[i+1]&&Math.min(...slopes.slice(i+1,i+5))<v-.46);
  expect(a[at(rows-1,0)+2]).toBeLessThan(-1);expect(turns.length).toBeGreaterThanOrEqual(3);
});

// CPU painter at its production 2× tile tier, sampled down at the real
// 156 × 128 window. Count only pixels covered by the lining AND still
// visible in the final exterior; changing the backdrop cannot pass this.
function viewport(){
  const w=324,h=356,ox=164,oy=204,unit=66;
  let rgba=new Uint8ClampedArray(w*h*4);
  const ctx={createImageData:()=>({data:rgba}),putImageData:(img:{data:typeof rgba})=>{rgba=img.data;}} as unknown as CanvasRenderingContext2D;
  const skin=exteriorBrush(ctx,w,h,ox,oy,unit),lining=entranceBrush(w,h,ox,oy,unit),ink=new Uint8ClampedArray(w*h*4),depth=new Float32Array(w*h);
  const W=156,H=128,zoom=.94*Math.min(W/162,H/178);
  return (s:PelvicSample|null,degrees:number,parked=false)=>{
    const yaw=degrees*Math.PI/180,co=Math.cos(yaw),si=Math.sin(yaw),cut=observedCut(s,parked),load=entranceLoad(s,cut);
    skin(yaw,cut,'natural','off',load);ink.fill(0);depth.fill(-Infinity);lining(co,si,cut,load,depth,ink);
    let visible=0,masked=0,deep=0,sumX=0,deepX=0,min=255,max=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      let count=0,covered=0,z=0,green=0;
      for(const dy of [.17,.5,.83])for(const dx of [.17,.5,.83]){
        const u=Math.floor(w/2+2*(x+dx-W/2)/zoom),v=Math.floor(h/2+2*(y+dy-H/2)/zoom);if(u<0||v<0||u>=w||v>=h)continue;
        const i=v*w+u,j=4*i;if(!ink[j+3])continue;covered++;
        if(rgba[j]!==ink[j]||rgba[j+1]!==ink[j+1]||rgba[j+2]!==ink[j+2])continue;
        count++;z+=si*(u+.5-ox)/unit+co*depth[i];green+=rgba[j+1];
      }
      if(count<5){if(covered>=5)masked++;continue;}
      visible++;sumX+=x;green/=count;min=Math.min(min,green);max=Math.max(max,green);
      if(z/count<-.64){deep++;deepX+=x;}
    }
    return {visible,masked,parallax:deepX/(deep||1)-sumX/(visible||1),deep,range:max-min,bytes:Buffer.from(rgba)};
  };
}
it('resolves the nested wall at 156 px, with signed parallax, lip occlusion, shallow release and a closed profile',()=>{
  const render=viewport(),pose=stroke(),rest=render(null,0),shallow=render(pose(5).s,0),s=pose(39).s,front=render(s,0),left=render(s,-38),right=render(s,38);
  expect(front.visible).toBeGreaterThan(650);expect(rest.visible).toBeLessThan(.12*front.visible);expect(shallow.visible).toBeLessThan(.55*front.visible);
  expect(front.deep).toBeGreaterThan(45);expect(front.range).toBeGreaterThan(64);
  for(const side of [left,right]){expect(side.masked).toBeGreaterThan(10);expect(side.deep).toBeLessThan(front.deep);expect(side.visible).toBeLessThan(.82*front.visible);}
  expect(left.parallax).toBeGreaterThan(3);expect(right.parallax).toBeLessThan(-3);
  expect(render(s,82).deep).toBe(0);expect(render(s,90).visible).toBe(0);
  const offset=render(stroke(.006)(39).s,0);expect(offset.bytes.equals(front.bytes)).toBe(false);
  expect(render(pose(5).s,0).bytes.equals(shallow.bytes)).toBe(true);
  for(const idle of [render(pose(-8).s,0),render(s,0,true),render({...s,outletInside:false},0)])expect(idle.bytes.equals(rest.bytes)).toBe(true);
});
