import { expect, it } from 'vitest';
import { advanceBody, BODY_DAY_SECONDS, DEFAULT_BODY_PROFILE as p, functionalDepthAt, moveDay, normalizeBody, sampleBody } from './data';

it('bounds phase lengths together, never simulates ovulation or a luteal phase on the no-ovulation timeline',()=>{
  const shortest=normalizeBody({...p,length:2,day:90,bleedDays:40,peakDays:90,lutealDays:20});
  expect(shortest).toMatchObject({length:14,day:14,bleedDays:11,peakDays:1,lutealDays:1});
  const profile={...p,ovulation:false};
  const phases=Array.from({length:profile.length},(_,i)=>sampleBody({...profile,day:i+1}).phase);
  expect(new Set(phases)).toEqual(new Set(['bleed','follicular']));
  expect(moveDay({...p,day:1},-1).day).toBe(p.length);expect(moveDay({...p,day:p.length},1).day).toBe(1);
  for(let day=1;day<=profile.length;day++){
    const sample=sampleBody({...profile,day});
    expect(sample.tissue.glandCoil).toBeLessThan(.1);
    expect(sample.tissue.vesselCoil).toBeLessThan(.25);
    expect(sampleBody({...profile,day,peakDays:1,lutealDays:1})).toEqual(sample);
  }
});

it('changes label at the actual fractional-date boundary, with continuous geometry even for one-day phases',()=>{
  for(const params of [p,{...p,length:14,bleedDays:11,peakDays:1,lutealDays:1},
    {...p,length:60,bleedDays:1,peakDays:6,lutealDays:22},{...p,length:14,bleedDays:11,ovulation:false}]){
    const active=normalizeBody({...params,locked:false, sensitivityMode:'cycle'});
    const {length,bleedDays,peakDays,lutealDays,ovulation}=active;
    const boundaries:[number,string,string][]=[[bleedDays,'bleed','follicular'],[length,ovulation?'luteal':'follicular','bleed']];
    if(ovulation)boundaries.push([length-lutealDays-peakDays,'follicular','ovulatory'],[length-lutealDays,'ovulatory','luteal']);
    for(const [day,previous,next] of boundaries){
      const t=day*BODY_DAY_SECONDS;
      const before=sampleBody(advanceBody(active,t-.00001)),exact=sampleBody(advanceBody(active,t));
      const after=sampleBody(advanceBody(active,t+.00001));
      expect([before.phase,exact.phase,after.phase]).toEqual([previous,next,next]);
      for(const k of ['lining','shedding','secretion','fullness','sensitivity'] as const)expect(Math.abs(before[k]-after[k])).toBeLessThan(1e-6);
      for(const k of ['functionalDepth','breakdown','glandCoil','vesselCoil'] as const)expect(Math.abs(before.tissue[k]-after.tissue[k])).toBeLessThan(1e-6);
    }
    // A midpoint offset used to shift the last half of a bleeding day into repair.
    const last=sampleBody(advanceBody(active,(bleedDays-.25)*BODY_DAY_SECONDS));
    expect(last.shedding).toBeGreaterThan(0);
    expect(sampleBody(advanceBody(active,bleedDays*BODY_DAY_SECONDS)).shedding).toBe(0);
  }
});

it('sheds functionalis at selected sites while neighbours survive, then regrows straight glands before coiling',()=>{
  const mid=sampleBody({...p,day:3,daySeconds:BODY_DAY_SECONDS/2}).tissue;
  expect(functionalDepthAt(mid,.53)).toBeCloseTo(0,8);
  expect(functionalDepthAt(mid,.34)).toBe(mid.functionalDepth);
  const after=sampleBody({...p,day:6}).tissue, repair=sampleBody({...p,day:10}).tissue;
  const peri=sampleBody({...p,day:15}).tissue, secretory=sampleBody({...p,day:23}).tissue;
  expect(functionalDepthAt(repair,.53)).toBe(repair.functionalDepth);
  expect(repair.functionalDepth).toBeGreaterThan(after.functionalDepth);
  expect(peri.functionalDepth).toBeGreaterThan(repair.functionalDepth);
  expect(secretory.functionalDepth).toBeGreaterThan(peri.functionalDepth);
  expect(repair.glandCoil).toBeLessThan(.1); expect(secretory.glandCoil).toBeGreaterThan(.7);
  expect(secretory.vesselCoil).toBeGreaterThan(peri.vesselCoil+.5);
});

it('decouples manual depth from differentiation and independently freezes the fractional date',()=>{
  for(const level of [0,.37,1]){
    const fixed={...p,liningOverride:level,secretionOverride:0};
    for(const day of [3,10,15,23]){
      const s=sampleBody({...fixed,day});
      expect(s).toMatchObject({lining:level,tissue:{functionalDepth:level},secretion:0});
      expect(functionalDepthAt(s.tissue,.34)).toBe(level);
      if(day!==3||level===0)expect(functionalDepthAt(s.tissue,.53)).toBe(level);
    }
    expect(sampleBody({...fixed,day:10}).tissue.glandCoil).toBeLessThan(sampleBody({...fixed,day:23}).tissue.glandCoil);
  }
  const steady={...p,liningGain:0};
  expect(sampleBody({...steady,day:3}).tissue).toEqual(sampleBody({...steady,day:23}).tissue);
  const locked={...p,day:3,daySeconds:49.5,lactating:true};
  expect(sampleBody(advanceBody(locked,237))).toEqual(sampleBody(locked));
  expect(sampleBody(moveDay(moveDay(locked,-3),3))).toEqual(sampleBody(locked));
  const repeat=advanceBody({...locked,locked:false},BODY_DAY_SECONDS*p.length*3);
  expect(sampleBody(repeat)).toEqual(sampleBody(locked));
});

it('advances only explicit simulation time, independently replenishes enabled stores even with the day locked',()=>{
  const locked={...p,lactating:true,left:.1,right:.8,refillSeconds:100};
  const filled=advanceBody(locked,35);expect(filled).toMatchObject({day:1,daySeconds:0,right:1});expect(filled.left).toBeCloseTo(.45);
  const running=advanceBody({...locked,lactating:false,locked:false,day:28},BODY_DAY_SECONDS+2.5);
  expect(running).toMatchObject({day:1,daySeconds:2.5,left:.1,right:.8,lactating:false});
  for(const seconds of [-1,Infinity,NaN])expect(advanceBody(running,seconds)).toBe(running);
});

it('keeps optional sensitivity purely informational, including on a rig with no shape or touch support',()=>{
  for(const lactating of [true,false]){
    const value={...p,day:23,compression:.2,rebound:.26,lactating,fullness:.3,left:.1,right:.8};
    const off=sampleBody(value),manual=sampleBody({...value,sensitivityMode:'manual',sensitivity:.65});
    expect(manual).toEqual({...off,sensitivity:.65}); expect(off.sensitivity).toBe(0);
    expect(sampleBody({...value,sensitivityMode:'cycle'}).sensitivity).toBeGreaterThan(0);
    expect(sampleBody({...value,sensitivityMode:'cycle',ovulation:false}).sensitivity).toBe(0);
    expect(normalizeBody({...value,sensitivityMode:'manual',sensitivity:2})).toMatchObject({compression:.2,rebound:.26,lactating,left:.1,right:.8,sensitivity:1});
  }
});
