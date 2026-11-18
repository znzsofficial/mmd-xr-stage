import { beforeEach, describe, expect, it } from 'vitest';
import { gripLatch, markAt, POST_MARKS, useStagePlay } from './stagePlay';

const get=useStagePlay.getState;
beforeEach(()=>get().reset());
describe('lunar postcard and held tools',()=>{
  it('takes three distinct stamps, keeps the first postmark after stowing, resets at a room boundary',()=>{
    get().equip('post','left');expect(markAt(0,0)).toBe(-1);
    for(const i of [1,1,5,-1,0,2])get().stamp(i);
    expect(get().stamps).toEqual([1,0,2]);get().stow();expect(get().held).toBeNull();expect(get().stamps[0]).toBe(1);
    get().reset();get().equip('bubbles','right');for(const [x,y] of POST_MARKS)get().stamp(markAt(x,y));expect(get().stamps).toEqual([]);
  });
  it('requires a fresh squeeze after a menu or lost tracking rather than activating on recovery',()=>{
    const step=gripLatch();expect(step(true,true)).toBe('off');step(true,false);
    expect(step(true,true)).toBe('start');expect(step(true,true)).toBe('held');
    step(false,true);expect(step(true,true)).toBe('off');step(true,false);expect(step(true,true)).toBe('start');
  });
});
