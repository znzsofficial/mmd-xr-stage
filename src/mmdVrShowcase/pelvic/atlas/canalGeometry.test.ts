import {expect,it,vi} from 'vitest';
import {DoubleSide,Float32BufferAttribute,BufferGeometry,Mesh,MeshBasicMaterial,Raycaster,Vector3,Matrix4} from 'three';
import {createPelvicSolver,pelvicRailMatrix} from '../geometry';
import {canalY,ENTRY,STOP,stride,type Mesh as StudyMesh} from './model';
import {canalBands,canalStudy,canalStation,mucosaEnd} from './canalGeometry';
import {createCanalContact,fitWall} from './canalContact';
import type {PelvicSample} from '../stateTypes';
import {createOrganArt,type OrganArtOptions} from './organArt';

// The marker, sleeve and wall receive the *same* current, admitted mould on
// the calibrated curved path. No fabricated shaft axis or target depth.
function session(x=0){
  const solver=createPelvicSolver(),f={world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.024,lengthM:.092};
  let mm=-20;
  function frame():PelvicSample{
    const m=pelvicRailMatrix(f,mm/1000);m.elements[12]+=x;
    const c=solver.step(f,m,{dt:1/72});return {tip:c.outletLocal.toArray(),tail:c.shaftLocal[0].toArray(),shaft:c.shaftLocal.map(v=>v.toArray()),
      outletInside:c.outletInside,outletVisible:c.outletVisible,atCervix:c.atCervix,aligned:c.inside,depth:c.depthM,radiusM:f.radiusM,lengthM:f.lengthM,angleDeg:0};
  }
  frame();return (to:number)=>{let sample=frame();while(mm!==to){mm+=Math.sign(to-mm);sample=frame();}return sample;};
}
function atX(mesh:StudyMesh,row:number,x:number,data=mesh.a){
  // Sample the same anatomical X even when the mucosal mesh is retessellated.
  const a=mesh.a;let i=row*mesh.cols*stride;
  for(let j=0;j<Math.round((mesh.cols-1)*mucosaEnd);j++,i+=stride)if(a[i]<=x&&a[i+stride]>=x){const k=(x-a[i])/(a[i+stride]-a[i]);return data[i+1]+k*(data[i+stride+1]-data[i+1]);}
  throw new Error('outside retained tissue');
}
it('keeps the opposing sheets in contact below the vault and closes the deep end with a protruding, solid cervical surface',()=>{
  const {posterior:p,anterior:a,cervix,vault,fornix}=canalStudy();
  const heights=Array.from({length:canalBands},(_,i)=>({t:canalStation(i),gap:atX(a,i,.48)-atX(p,i,.48)}));
  for(const {gap} of heights.filter(h=>h.t<.78))expect(gap).toBeCloseTo(.012,2);
  expect(heights.filter(h=>h.t>1.16).every(h=>h.gap>.55)).toBe(true);
  const relief=heights.filter(h=>h.t<.77).map(({t},i)=>atX(p,i,.30)-canalY(t));
  const peaks=relief.flatMap((v,i)=>v>relief[i-1]&&v>relief[i+1]?[i]:[]);
  expect(peaks.length).toBeGreaterThanOrEqual(4);expect(peaks.length).toBeLessThanOrEqual(7);
  const pitches=peaks.slice(1).map((i,k)=>i-peaks[k]);expect(Math.max(...pitches)-Math.min(...pitches)).toBeGreaterThan(2);
  // The central axial ray must hit the projecting cervix before the roof;
  // the lateral ray can enter the deeper closed fornix alongside it.
  function distal(mesh:StudyMesh,x:number){
    const g=new BufferGeometry(),positions=new Float32Array(mesh.cols*mesh.rows*3);for(let i=0,j=0;i<mesh.a.length;i+=stride,j+=3)positions.set(mesh.a.subarray(i,i+3),j);
    g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(Array.from(mesh.indices));
    const mat=new MeshBasicMaterial({side:DoubleSide}),m=new Mesh(g,mat);
    const hit=new Raycaster(new Vector3(x,canalY(1),ENTRY),new Vector3(0,0,1)).intersectObject(m)[0]?.point.z;g.dispose();mat.dispose();return hit;
  }
  // Use a station inside the pocket, not past the rolled edge of this
  // oblique cut. The same lateral ray must clear the cervix and hit its roof.
  const lateral=.60,nose=distal(cervix,0),roof=distal(vault,lateral);expect(nose).toBeDefined();expect(roof).toBeDefined();
  expect(Math.abs(nose!-STOP)).toBeLessThan(.38);expect(roof!-nose!).toBeGreaterThan(.22);expect(distal(cervix,lateral)).toBeUndefined();
  expect(distal(fornix,0)??Infinity).toBeGreaterThan(nose!);expect(Math.min(distal(fornix,lateral)??Infinity,roof!)-nose!).toBeGreaterThan(.22);
});

it('flattens actual posterior fold crests under the measured shaft and recovers their profile as it withdraws',()=>{
  const pose=session(.002),m=canalStudy().posterior,contact=createCanalContact(),out=m.a.slice();
  const range=Array.from({length:m.rows},(_,i)=>i).filter(i=>canalStation(i)>.22&&canalStation(i)<.49);
  function trace(x:number,data:Float32Array){return range.map(i=>atX(m,i,x,data));}
  // Variation of the slope removes a rigid translation/tilt. Moving the
  // entire wall or a tip icon without pressing out the rugae cannot pass.
  function bends(y:number[]){return y.slice(1,-1).reduce((s,h,i)=>s+Math.abs(y[i]-2*h+y[i+2]),0);}
  contact.update(pose(60));fitWall(m,-1,contact,out);
  for(const x of [-.10,.16]){const raw=bends(trace(x,m.a));expect(raw).toBeGreaterThan(.09);expect(bends(trace(x,out))).toBeLessThan(raw*.32);}
  contact.update(pose(14));fitWall(m,-1,contact,out);for(const x of [-.10,.16])expect(trace(x,out)).toEqual(trace(x,m.a));
});

// Capture the production CPU z-buffer *before* the separate tip annotations.
// A changed dot, caption or ledger alone cannot make this comparison pass.
it('rasterizes a local impression in the actual oblique brush; dwell reuses the image and retraction restores the deep tissue',()=>{
  let pixels:Uint8ClampedArray|undefined,uploads=0;
  class Bitmap {width:number;height:number;constructor(w:number,h:number){this.width=w;this.height=h;}
    getContext(){return {createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:(img:{data:Uint8ClampedArray})=>{pixels=img.data.slice();uploads++;}};}}
  vi.stubGlobal('OffscreenCanvas',Bitmap);
  const ctx=new Proxy({getTransform:()=>({a:1,b:0,c:0,d:1})},{get:(o,k)=>k==='getTransform'?o.getTransform:()=>{},set:()=>true}) as unknown as CanvasRenderingContext2D;
  const art=createOrganArt(),pose=session(.002),w=228,h=186;
  const o:OrganArtOptions={x:0,y:0,width:w,height:h,yaw:38*Math.PI/180,time:0,lining:.5,shedding:0,fluid:0,vaginalFluid:0,fantasy:false,focus:'vagina',pressure:0,zh:true};
  const draw=(patch:Partial<OrganArtOptions>={})=>{art.draw(ctx,{...o,...patch});return pixels!;};
  function changed(a:Uint8ClampedArray,b:Uint8ClampedArray,first:number,last:number){let diff=0;
    for(let i=4*w*Math.floor(first*h);i<4*w*Math.floor(last*h);i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>9)diff++;return diff;}
  try{
    const rest=draw(),deep=draw({sample:pose(60)}),before=uploads;draw({sample:pose(60),time:5,pressure:1});expect(uploads).toBe(before);
    const pull=draw({sample:pose(18)});
    expect(changed(rest,deep,0,.36)).toBe(0);expect(changed(rest,deep,.51,.68)).toBeGreaterThan(65);
    expect(changed(rest,pull,.51,.68)).toBe(0);expect(changed(rest,pull,.74,.89)).toBeGreaterThan(28);
    expect(changed(rest,draw({parked:true,sample:pose(60),pressure:1}),0,1)).toBe(0);
    const wet=draw({vaginalFluid:.4});expect(changed(rest,wet,.66,.91)).toBeGreaterThan(30);expect(changed(rest,wet,0,.40)).toBe(0);
    const side=draw({yaw:Math.PI/2}),front=draw({yaw:0});expect(changed(side,front,.15,.83)).toBeGreaterThan(400);
    expect(changed(rest,draw(),0,1)).toBe(0);
  }finally{art.dispose();vi.unstubAllGlobals();}
});

it('impresses only intersected shaft sections, keeps dwell, releases vacated folds first, and ignores stale HUD depth',()=>{
  const pose=session(.002),study=canalStudy(),contact=createCanalContact(),mesh=study.anterior,out=mesh.a.slice();
  const deep=pose(60);expect(deep.outletInside).toBe(true);expect(contact.update({...deep,depth:0})).toBe(true);fitWall(mesh,1,contact,out);
  const movement=(lo:number,hi:number)=>{let max=0;for(let i=0;i<out.length;i+=stride){const t=(mesh.a[i+2]-ENTRY)/(STOP-ENTRY);
    if(t>lo&&t<hi)max=Math.max(max,Math.abs(out[i+1]-mesh.a[i+1]));}return max;};
  expect(movement(.12,.23)).toBeGreaterThan(.13);expect(movement(.38,.53)).toBeGreaterThan(.09);expect(movement(.73,1.3)).toBe(0);
  expect(contact.update(pose(60))).toBe(false);const shallow=pose(25);contact.update(shallow);fitWall(mesh,1,contact,out);
  expect(movement(.06,.18)).toBeGreaterThan(.09);expect(movement(.32,1.3)).toBe(0);
  for(const invalid of [null,{...deep,outletInside:false},{...deep,shaft:undefined}]){contact.update(deep);contact.update(invalid);expect(contact.active).toBe(false);}
  contact.update(deep);contact.update(deep,true);expect(contact.active).toBe(false);
  const outside=pose(-9);contact.update(outside);expect(contact.offset(0,0,ENTRY,1)).toBe(0);
});

it('fits lateral tissue from the measured off-axis mould and its interpolated cross section, independently of the depth readout',()=>{
  const L=createCanalContact(),R=createCanalContact(),l=session(-.0022)(55),r=session(.0022)(55);
  expect(l.outletInside&&r.outletInside).toBe(true);L.update(l);R.update({...r,depth:l.depth});
  const t=canalStation(17),z=ENTRY+t*(STOP-ENTRY),y=canalY(t);
  expect(R.offset(.5,y,z,1)).toBeGreaterThan(L.offset(.5,y,z,1)+.025);
  expect(L.offset(-.5,y,z,1)).toBeGreaterThan(R.offset(-.5,y,z,1)+.025);
  const rings:number[][]=[];R.rings((_,...values)=>rings.push(values));expect(rings.at(-1)![0]).toBeCloseTo(ENTRY+r.depth/r.lengthM*(STOP-ENTRY),5);
  expect(R.offset(0,y,STOP,1)).toBe(0);const snapshot=rings.map(row=>[...row]);R.update({...r,depth:.001});const unchanged:number[][]=[];R.rings((_,...v)=>unchanged.push(v));expect(unchanged).toEqual(snapshot);
});
