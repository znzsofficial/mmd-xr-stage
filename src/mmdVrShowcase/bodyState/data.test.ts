import {expect,it} from 'vitest';
import {DEFAULT_BODY_PROFILE as p,normalizeBody,refillMilk} from './data';

it('accepts ordinary actor settings without retaining retired timeline fields',()=>{
  const legacy={...p,day:23,daySeconds:12,length:28,locked:false,reproduction:true,cycleGain:.9,liningOverride:0,
    fullness:.3,left:.1,right:.8};
  const value=normalizeBody(legacy);
  expect(value).toEqual({...p,fullness:.3,left:.1,right:.8});
  expect(normalizeBody({...value,sensitivityMode:'manual',sensitivity:2,rebound:Infinity})).toMatchObject({sensitivity:1,rebound:p.rebound});
});

it('refills each side to its limit without changing shape or touching an idle actor',()=>{
  const actor={...p,lactating:true,left:.1,right:.8,refillSeconds:100,fullness:.4};
  const half=refillMilk(actor,35);expect(half.left).toBeCloseTo(.45);expect(half).toEqual({...actor,left:half.left,right:1});
  const full=refillMilk(half,80);expect(full).toEqual({...actor,left:1,right:1});expect(refillMilk(full,3600)).toBe(full);
  expect(refillMilk(p,3600)).toBe(p);for(const s of [0,-10,NaN,Infinity])expect(refillMilk(actor,s)).toBe(actor);
});
