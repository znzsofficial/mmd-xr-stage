import {expect,it} from 'vitest';
import {createRailRecorder,createRailReplay,MAX_TAKE_SECONDS} from './railTechnique';

it('keeps the partial final timestamp and a finite sample budget, independent of input frequency',()=>{
  const r=createRailRecorder();expect(r.sample(.01,.4)).toBe(false);
  r.sample(.01,-.2);r.hold(.63);expect(r.finish()).toBeNull();
  for(let i=1;i<=551;i++)r.sample(.001,-.2+i*.001);
  const clip=r.finish()!;expect(clip.seconds).toBeCloseTo(1.181,9);
  expect(clip.positions.at(-1)).toBeCloseTo(.351,7);expect(clip.positions[36]).toBe(-.2);
  r.hold(1000);const full=r.finish()!;
  expect(full.seconds).toBe(MAX_TAKE_SECONDS);expect(full.positions).toHaveLength(MAX_TAKE_SECONDS*60+1);
  expect(full.positions.at(-1)).toBeCloseTo(.351);expect(clip.positions.length).toBeLessThan(full.positions.length);
});

it('shows a short reversal even at a slow refresh, and waits for a real exterior frame before looping',()=>{
  const r=createRailRecorder();r.sample(.01,-.2);
  r.sample(.2,.2);r.sample(.04,.12);r.sample(.1,.32);
  const replay=createRailReplay(r.finish()!);
  const seen:number[]=[];let p=-.2;
  for(let i=0;i<16;i++){const last=p;p=replay.next(.085,2,true);seen.push(p);
    expect(Math.abs(p-last)).toBeLessThanOrEqual(.201);replay.presented(false,true);}
  expect(Math.max(...seen)).toBeCloseTo(.32);expect(seen.some((n,i)=>i>0&&n>seen[i-1]&&seen[i+1]<n)).toBe(true);
  expect(seen.slice(-4)).toEqual([-.2,-.2,-.2,-.2]);
  replay.presented(true,true);expect(replay.next(.016,1,true)).toBeGreaterThan(-.2);
});
