import {expect,it} from 'vitest';
import {DEFAULT_BODY_PROFILE as defaults} from '../../bodyState/data';
import {nextMilestone,progressDays,receiveDose,reproductiveSample,startGame} from '../../bodyState/reproduction/game';
import {encounterCut,encounterSwimmers} from './conceptionStudy';
import {activeSites} from './reproductionArt';

const ovulation={...defaults,day:15};
it('allows the same close-up before either outcome, then gives the membrane a single squeeze and afterglow only on fusion',()=>{
  const open=reproductiveSample(startGame('asset-1',ovulation)),success=reproductiveSample(receiveDose(startGame('asset-1',ovulation))),
    miss=reproductiveSample(receiveDose(startGame('asset-2',ovulation)));
  expect(encounterCut(open,4)).toMatchObject({close:0,warmth:0,title:undefined});
  expect(encounterCut(success,4)).toEqual(encounterCut(miss,4));expect(encounterCut(miss,4)).toMatchObject({close:1,title:'ring'});
  expect(encounterCut(success,7.05)).toMatchObject({title:'fusion',press:1,lift:0});const recoil=encounterCut(success,7.98);
  expect(recoil).toMatchObject({press:0,warmth:1});expect(recoil.lift).toBeCloseTo(1,3);
  expect(encounterCut(success,9.4).warmth).toBeGreaterThan(.5);expect(encounterCut(success,12)).toMatchObject({close:0,press:0,lift:0,warmth:0,title:'zygote'});
  for(let t=0;t<=12;t+=.25)expect(encounterCut(miss,t)).toMatchObject({press:0,lift:0,warmth:0});
  expect(encounterCut(miss,12).title).toBe('miss');
});
it('keeps a quiet released ovum, even after an earlier out-of-window delivery; failure has swimmers but no membrane crossing',()=>{
  const early=receiveDose(startGame('asset-2',{...defaults,day:10})),open=progressDays(early,5,defaults),failed=receiveDose(open);
  const before=reproductiveSample(open),after=reproductiveSample(failed);
  expect(before.exposed).toBe(true);expect(encounterSwimmers(before,4)).toEqual([]);expect(after.stage).toBe('unfertilized');
  expect(encounterSwimmers(after,4)).toHaveLength(6);
  for(let t=0;t<=12;t+=.125)for(const head of encounterSwimmers(after,t)){
    expect(head.fusion).toBe(0);expect(Math.hypot(head.x,head.y)).toBeGreaterThan(.56);
  }
  expect(encounterSwimmers(after,12)).toEqual([]);
});

it('gives the six independent swimmers real travel; only one enters, and only one embryo develops from two ovulations',()=>{
  const two=startGame('asset-18',ovulation),fertilized=receiveDose(two),s=reproductiveSample(fertilized);
  expect(s).toMatchObject({eggs:2,secondOvum:true,stage:'fertilized'});expect(activeSites(s)).toHaveLength(2);
  const ring=encounterSwimmers(s,4.5);expect(ring).toHaveLength(6);
  expect(new Set(ring.map(h=>`${Math.sign(h.x)},${Math.sign(h.y)}`)).size).toBe(4);
  // A head may turn and nearly return to its original position. Measure the
  // path it actually swims during the ring phase, not a two-frame chord.
  const frames=Array.from({length:25},(_,i)=>encounterSwimmers(s,3.2+i/10));
  for(const head of ring){
    const track=frames.map(frame=>frame.find(h=>h.index===head.index)!);
    const travel=track.slice(1).reduce((sum,h,i)=>sum+Math.hypot(h.x-track[i].x,h.y-track[i].y),0);
    expect(travel,`travel of swimmer ${head.index} in lens radii`).toBeGreaterThan(.08);
    expect(track.at(-1)!.beat).toBeGreaterThan(track[0].beat);
  }
  const entering=new Set<number>();for(let t=0;t<=12;t+=.08)for(const head of encounterSwimmers(s,t))if(Math.hypot(head.x,head.y)<.47){expect(head.fusion).toBeGreaterThan(0);entering.add(head.index);}
  expect(entering.size).toBe(1);expect(encounterSwimmers(s,12)).toHaveLength(0);
  let g=fertilized;const cells=[];
  for(let step=0;step<4;step++){
    g=progressDays(g,nextMilestone(g).days,defaults);const sample=reproductiveSample(g);
    if(sample.stage==='transit')cells.push(sample.cells);expect(encounterSwimmers(sample,4)).toHaveLength(0);
    if(step>=1)expect(activeSites(sample)).toHaveLength(1);
  }
  expect(cells).toEqual([2,4,8]);expect(reproductiveSample(g).stage).toBe('cavity');
});
