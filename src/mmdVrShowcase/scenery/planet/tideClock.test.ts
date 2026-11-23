import {expect,it} from 'vitest';
import {createTideClock,ebbLevel,floodLevel} from './tideClock';

it('uncovers the shell treads, floods them and holds each stand long enough to walk to the stage',()=>{
  const clock=createTideClock(),go=(s:number)=>{for(let i=0;i<s*60;i++)clock.step(1/60);return clock.level;};
  expect(go(24)).toBe(ebbLevel);expect(go(11)).toBeGreaterThan(ebbLevel);expect(go(11)).toBeCloseTo(floodLevel,6);
  expect(go(23)).toBeCloseTo(floodLevel,9);expect(go(21)).toBeCloseTo(ebbLevel,6);expect(clock.step(180)).toBeCloseTo(ebbLevel,6);
});
it('reverses an incoming tide in place and settles at the requested stand, on the shared gauge and water clock',()=>{
  const c=createTideClock();c.turn();for(let i=0;i<100;i++)c.step(.025);const mid=c.level;
  expect(mid).toBeGreaterThan(ebbLevel+.1);expect(mid).toBeLessThan(floodLevel-.1);c.turn();expect(c.level).toBe(mid);expect(c.step(.016)).toBeCloseTo(mid,3);
  for(let i=0;i<200;i++)c.step(.025);expect(c.level).toBeCloseTo(ebbLevel,9);c.turn();for(let i=0;i<200;i++)c.step(.025);expect(c.level).toBeCloseTo(floodLevel,9);
});
