import { expect, it } from 'vitest';
import { advanceBody, BODY_DAY_SECONDS, DEFAULT_BODY_PROFILE as p, moveDay, normalizeBody, sampleBody } from './data';

it('bounds phase lengths together, never simulates ovulation or a luteal phase on the no-ovulation timeline',()=>{
  const shortest=normalizeBody({...p,length:2,day:90,bleedDays:40,peakDays:90,lutealDays:20});
  expect(shortest).toMatchObject({length:14,day:14,bleedDays:11,peakDays:1,lutealDays:1});
  const profile={...p,ovulation:false};
  const phases=Array.from({length:profile.length},(_,i)=>sampleBody({...profile,day:i+1}).phase);
  expect(new Set(phases)).toEqual(new Set(['bleed','follicular']));
  expect(moveDay({...p,day:1},-1).day).toBe(p.length);expect(moveDay({...p,day:p.length},1).day).toBe(1);
  expect(sampleBody(p).shedding).toBeGreaterThan(0);
  expect(sampleBody({...p,day:7}).lining).toBeLessThan(sampleBody({...p,day:20}).lining);
  expect(sampleBody({...p,liningOverride:.37,secretionOverride:0,day:14})).toMatchObject({lining:.37,secretion:0});
  expect(sampleBody({...p,day:15,liningGain:0,secretionGain:0}).lining).toBe(sampleBody({...p,day:25,liningGain:0,secretionGain:0}).lining);
});

it('has continuous section envelopes across phase changes and the cycle seam',()=>{
  const active={...p,locked:false};
  for(const boundary of [5,13,16,28]){
    const t=(boundary-.5)*BODY_DAY_SECONDS;
    const a=sampleBody(advanceBody(active,t-.00001)),b=sampleBody(advanceBody(active,t+.00001));
    for(const k of ['lining','shedding','secretion','fullness'] as const)expect(Math.abs(a[k]-b[k])).toBeLessThan(1e-6);
  }
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
