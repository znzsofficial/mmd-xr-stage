import { beforeEach, describe, expect, it } from 'vitest';
import { gripLatch, markAt, POST_MARKS, shelfToys, STORIES, useStagePlay } from './stagePlay';

const get=useStagePlay.getState;
beforeEach(()=>get().reset());
describe('lunar postcard and held tools',()=>{
  it('fits each local story on the existing shelf and gives the same prop across both wrists',()=>{
    for(const room of ['pool','lawn','liveHouse'] as const){const toy=STORIES[room].toy;
      const shelf=shelfToys(room);expect(shelf.length).toBeLessThanOrEqual(3);expect(shelf).toContain(toy);expect(shelf).toContain('saber');
      get().equip(toy,'left');get().give('actor','right');get().give('actor','left');expect(get().character).toMatchObject({toy,assetId:'actor',hand:'left'});expect(get().held).toBeNull();get().stow();
    }expect(shelfToys('floor')).toContain('post');expect(shelfToys('chapel')).not.toContain('kite');
  });
  it('keeps a lit blade on the chosen animated wrist, but drops its light when stowed or re-equipped',()=>{
    get().equip('saber','right');expect(get().saberLit).toBe(false);get().toggleSaber();
    get().give('actor','left');get().toggleSaber();get().give('actor','right');
    expect(get().held).toBeNull();expect(get().character).toMatchObject({toy:'saber',hand:'right'});expect(get().saberLit).toBe(true);
    get().stow();expect(get().saberLit).toBe(false);get().equip('saber','left');get().toggleSaber();get().equip('bubbles','left');
    get().toggleSaber();expect(get().saberLit).toBe(false);
  });
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
