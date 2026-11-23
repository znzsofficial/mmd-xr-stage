import {expect,it,vi} from 'vitest';
import type {ConceptionEvent} from '../../bodyState/reproduction/game';
import {encounterCut,encounterSwimmers,paintConceptionLens} from './conceptionStudy';
import {lensView,nuclei,SHELL,type V} from './encounterGeometry';
import {drawEncounter} from './reproductionArt';
import {createOrganArt,type OrganArtOptions} from './organArt';

const hit:ConceptionEvent={id:11,side:-1,at:1200,chance:100,success:true};
const miss:ConceptionEvent={...hit,id:12,at:1600,chance:0,success:false};
const distance=(a:V,b:V)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const radius=(p:V)=>Math.hypot(...p);
it('holds one quiet egg without a delivery; both events get the same approach but only the recorded success changes the membrane',()=>{
  for(const t of [0,4.5,7.1,9.3,12]){
    expect(encounterSwimmers(undefined,t)).toHaveLength(0);expect(encounterCut(undefined,t)).toEqual({close:0,press:0,lift:0,warmth:0,title:undefined});
    expect(nuclei(undefined,t)).toEqual(nuclei(undefined,0));
  }
  expect(encounterSwimmers(miss,4.5)).toEqual(encounterSwimmers(hit,4.5));expect(encounterCut(miss,4.5)).toEqual(encounterCut(hit,4.5));
  expect(encounterSwimmers(miss,4.5)).toHaveLength(6);
  for(let t=0;t<=12;t+=.125){
    expect(encounterCut(miss,t)).toMatchObject({press:0,lift:0,warmth:0});expect(nuclei(miss,t).paternal).toBeNull();
    for(const swimmer of encounterSwimmers(miss,t)){
      const {head,axis,size}=swimmer,nose:V=[head[0]+.148*size*axis[0],head[1]+.148*size*axis[1],head[2]+.148*size*axis[2]];
      expect(radius(nose)).toBeGreaterThan(SHELL+.035);expect(Math.min(...swimmer.tail.map(radius))).toBeGreaterThan(SHELL+.04);
    }
  }
  expect(encounterCut(hit,7)).toMatchObject({title:'fusion',press:1});expect(encounterCut(hit,7.98)).toMatchObject({warmth:1,press:0});
  expect(encounterCut(miss,8).title).toBe('disperse');expect(encounterCut(miss,12).title).toBe('miss');
  // Switching to the latest miss must work immediately after a settled win.
  expect(nuclei(hit,12).united).toBe(1);expect(nuclei(miss,0)).toEqual(nuclei(undefined,0));
  for(const event of [hit,miss])expect(encounterSwimmers(event,12)).toHaveLength(0);
});

it('admits exactly one entrant: cap first, then head, midpiece, then the trailing end; the two internal nuclei approach before one settled cell',()=>{
  const crossing=new Set<number>(),times=[Infinity,Infinity,Infinity,Infinity];let tailInkAtCrossing=0;
  for(let i=0;i<=220;i++){
    const t=5+i*.025;
    for(const p of encounterSwimmers(hit,t)){
      if(radius(p.head)<SHELL||p.tail.some(v=>radius(v)<SHELL))crossing.add(p.index);
      if(p.index!==0)continue;const nose=p.head.map((v,k)=>v+p.axis[k]*.148*p.size) as V;
      const parts=[nose,p.head,p.tail[0],p.tail.at(-1)!];parts.forEach((v,j)=>{if(times[j]===Infinity&&radius(v)<SHELL){times[j]=t;if(j===3)tailInkAtCrossing=p.tailInk;}});
    }
  }
  expect([...crossing]).toEqual([0]);for(let i=1;i<times.length;i++)expect(times[i]-times[i-1]).toBeGreaterThan(.15);
  expect(times[3]).toBeLessThan(9.8);expect(tailInkAtCrossing).toBeGreaterThan(.75);
  expect(nuclei(hit,7.98).paternal).toBeNull();
  const overlap=encounterSwimmers(hit,8.62).find(p=>p.index===0)!,forming=nuclei(hit,8.62);
  expect(distance(overlap.head,forming.paternal!)).toBeLessThan(.001);expect(overlap.headInk+forming.drawn).toBeCloseTo(1);
  const separations=[8.88,9.72,10.83,11.48,12].map(t=>{const n=nuclei(hit,t);return distance(n.paternal!,n.maternal);});
  expect(separations[0]).toBeGreaterThan(.30);for(let j=1;j<separations.length;j++)expect(separations[j]).toBeLessThan(separations[j-1]);
  expect(separations.at(-1)).toBeLessThan(.00001);expect(encounterCut(hit,12)).toMatchObject({warmth:0,title:'zygote'});
  // Incoming event records, rather than the chance dial or a renderer roll,
  // own the outcome. A previously recorded 60% success is the same take.
  expect(encounterSwimmers({...hit,chance:60},7.6)).toEqual(encounterSwimmers(hit,7.6));
});

it('projects the same waving cohort through front, oblique and side: depth order changes, the silhouettes are not screen rotations',()=>{
  const frame=encounterSwimmers(hit,4.5),[front,oblique,side]=[0,38,90].map(lensView);
  for(const {head,tail} of frame){
    const a=front(head),b=side(head),c=oblique(head);expect(c[1]).toBe(a[1]);expect(b[1]).toBe(a[1]);
    expect(b[0]).toBeCloseTo(a[2]);expect(c[0]).toBeCloseTo(a[0]*Math.cos(38*Math.PI/180)+a[2]*Math.sin(38*Math.PI/180));
    expect(Math.max(...tail.map(v=>v[2]))-Math.min(...tail.map(v=>v[2]))).toBeGreaterThan(.025);
  }
  const hero=encounterSwimmers(hit,6.6)[0];expect(front(hero.head)[2]).toBeGreaterThan(.25);expect(side(hero.head)[2]).toBeLessThan(-.25);
  const next=encounterSwimmers(hit,4.68),bend=(s:typeof hero):V=>s.tail.at(-1)!.map((v,k)=>v-s.head[k]) as V;
  expect(frame.filter((s,i)=>distance(bend(s),bend(next[i]))>.02).length).toBeGreaterThanOrEqual(4);
  const moving=encounterSwimmers(hit,7.6);expect(encounterSwimmers(hit,4.5)).toEqual(frame);expect(moving).not.toEqual(frame);
});

// Record drawing commands without a DOM or second renderer. This exercises
// the public brush used by both sizes, including the caption opt-out.
function drawing(paint:(c:CanvasRenderingContext2D)=>void){
  const marks:(string|number)[][]=[],gradient={addColorStop(){}};
  const base={globalAlpha:1,createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,getTransform:()=>({a:1,b:0,c:0,d:1}),measureText:()=>({width:26})};
  const c=new Proxy(base,{get:(o,k)=>k in o?Reflect.get(o,k):(...args:(string|number)[])=>marks.push([String(k),...args])}) as unknown as CanvasRenderingContext2D;
  paint(c);return marks;
}
function impression(event:ConceptionEvent|undefined,age:number,degrees:number,caption:boolean){
  return drawing(c=>paintConceptionLens(c,event,100,100,82,true,2.5,age,encounterCut(event,age),degrees,caption));
}
it('retains an exact held frame, rotates the real brush in either lens and honours the caption switch',()=>{
  const a=impression(hit,7.6,38,false);expect(a.some(op=>op[0]==='fillText')).toBe(false);
  const titled=impression(hit,7.6,38,true);expect(titled.find(op=>op[0]==='fillText')?.[1]).toBe('精卵融合');
  expect(impression(hit,7.6,0,false)).not.toEqual(a);expect(impression(hit,7.6,90,false)).not.toEqual(a);expect(impression(hit,7.6,38,false)).toEqual(a);
  expect(impression(undefined,12,38,true).find(op=>op[0]==='fillText')?.[1]).toBe('卵子');
  expect(impression(miss,12,38,true).find(op=>op[0]==='fillText')?.[1]).toBe('未受精');
});

it('draws no cell, marker or encounter when the selected actor has no egg; an available egg has a real, rotatable study',()=>{
  const empty=drawing(c=>drawEncounter(c,undefined,344,282,true));
  expect(empty.map(([op])=>op)).toEqual(['save','fillRect','fillText','restore']);expect(empty.find(([op])=>op==='fillText')?.[1]).toBe('暂无卵子');
  const egg={id:1,side:-1 as const,fertilized:false},draw=(degrees:number)=>drawing(c=>drawEncounter(c,egg,344,282,true,12,degrees));
  expect(draw(0).filter(([op])=>op==='ellipse').length).toBeGreaterThan(10);expect(draw(0)).not.toEqual(draw(90));
  for(const [event,caption] of [[hit,'受精卵'],[miss,'未受精']] as const){
    const lines=drawing(c=>drawEncounter(c,{...egg,event,fertilized:event.success},344,282,true,12));
    expect(lines.find(([op])=>op==='fillText')?.[1]).toBe(caption);
  }
});

it('still rasterizes the complete uterine plate at every angle after a successful encounter, without painting a lens on top',()=>{
  let pixels=new Uint8ClampedArray(0);
  vi.stubGlobal('OffscreenCanvas',class{getContext(){return {createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:({data}:{data:Uint8ClampedArray})=>{pixels=data.slice();}};}});
  const art=createOrganArt(),o:OrganArtOptions={x:0,y:0,width:168,height:136,yaw:0,time:0,focus:'uterus',lining:.44,shedding:0,pressure:0,zh:true,fluid:0,fantasy:false};
  try{
    const views=new Set<string>();
    for(const deg of [0,38,90]){
      const options={...o,yaw:deg*Math.PI/180,encounterSeconds:12};
      const before=drawing(c=>art.draw(c,options));
      const after=drawing(c=>art.draw(c,{...options,event:hit}));
      expect(after.map(op=>op[0])).toEqual(before.map(op=>op[0]));
      expect(after.some(op=>op[0]==='drawImage')).toBe(true);expect(after.some(op=>op[0]==='fillText'&&op[1]==='子宫')).toBe(true);
      let tissue=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==33)tissue++;
      expect(tissue).toBeGreaterThan(500);views.add(String(tissue));
    }
    expect(views.size).toBe(3);
  }finally{art.dispose();vi.unstubAllGlobals();}
});
