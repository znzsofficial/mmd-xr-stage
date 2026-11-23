import {expect,it} from 'vitest';
import {DEFAULT_BODY_PROFILE as p} from '../data';
import {nextMilestone,progressDays,receiveDose,reproductiveSample,stageOf,startGame} from './game';

const released=(id:string)=>{const g=startGame(id,p);return progressDays(g,nextMilestone(g).days,p);};
it('starts with no retroactive eggs, expires a cohort after two game days, and never carries an early dose into a later window',()=>{
  const early=receiveDose(startGame('asset-1',p));expect(reproductiveSample(early)).toMatchObject({eggs:0,exposed:true,chance:0});
  const fertile=progressDays(early,nextMilestone(early).days,p);expect(fertile).toMatchObject({day:15,eggs:1,trial:null});
  expect(reproductiveSample(fertile)).toMatchObject({tried:false,chance:60});expect(reproductiveSample(progressDays(fertile,1,p))).toMatchObject({tried:false,chance:48});
  expect(reproductiveSample(progressDays(fertile,2,p))).toMatchObject({stage:'expired',fertilized:false,chance:0});
  expect(receiveDose(progressDays(fertile,2,p)).trial).toBeNull();
  const second=receiveDose(progressDays(fertile,1,p));expect(second.trial?.chance).toBe(48);
  const quiet=startGame('asset-1',{...p,ovulation:false});expect(stageOf(progressDays(quiet,27,p))).toBe('anovulatory');
  const next=progressDays(quiet,28,p);expect(next).toMatchObject({round:2,eggs:0,lastDoseDay:null});
});
it('opens on the saved rhythm and day, releasing only if today is actually release day',()=>{
  const rhythm={...p,length:32,peakDays:1,lutealDays:9},day=23;
  expect(reproductiveSample(startGame('actor',{...rhythm,day}))).toMatchObject({day,stage:'ovulated',tried:false,chance:60});
  const missed=startGame('actor',{...rhythm,day:day+1});expect(reproductiveSample(missed)).toMatchObject({stage:'unobserved',eggs:0,chance:0});
  expect(nextMilestone(missed)).toEqual({key:'round',days:9});
});
it('keeps one roll through repeat doses, transport and day partitioning; a positive fertilization is not yet a pregnancy',()=>{
  const fertilized=receiveDose(released('asset-1'));expect(reproductiveSample(fertilized)).toMatchObject({stage:'fertilized',gestation:0,chance:60});
  expect(receiveDose(fertilized)).toBe(fertilized);const sample=(n:number)=>reproductiveSample(progressDays(fertilized,n,p));
  expect(sample(1)).toMatchObject({stage:'transit',travel:.25,implanted:false});expect(sample(4)).toMatchObject({stage:'cavity',travel:1,implanted:false});
  expect(sample(6)).toMatchObject({stage:'pregnant',gestation:7});expect(sample(34)).toMatchObject({round:1,gestation:35});
  expect(progressDays(progressDays(fertilized,4,p),30,p)).toEqual(progressDays(fertilized,34,p));
  const end=progressDays(fertilized,1000,p);expect(reproductiveSample(end)).toMatchObject({stage:'complete',round:1,gestation:280});expect(nextMilestone(end).days).toBe(0);
});
it('persists both negative outcomes and only offers a fresh trial on a real new cycle',()=>{
  for(const [id,failed] of [['asset-2','unfertilized'],['asset-5','notImplanted']] as const){
    const first=receiveDose(released(id)),result=progressDays(first,6,p);
    expect(reproductiveSample(result)).toMatchObject({stage:failed,gestation:0,chance:60});
    expect(receiveDose(result)).toBe(result);expect(receiveDose(first)).toBe(first);
    const next=progressDays(result,nextMilestone(result).days,p);expect(next).toMatchObject({round:2,trial:null,eggs:0});
  }
});
