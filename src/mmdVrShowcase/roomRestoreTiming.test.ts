import {it,expect} from 'vitest';
import {createRoomRestoreTiming} from './roomRestoreTiming';
it('records a completed visit on its first visible frame only; a late completion cannot finish a different generation',async()=>{
  let ms=0;const r=createRoomRestoreTiming(()=>ms);r.begin('classroom','lawn',false);expect(r.bind('lawn')).toBeUndefined();
  r.begin('lawn','classroom',true);const obsolete=r.bind('classroom')!;r.cancel();r.begin('lawn','classroom',true);
  obsolete.ready(true);expect(r.frame('classroom')).toBeUndefined();const t=r.bind('classroom')!;ms=20;
  const [task]=t.wrap([{phase:'body',fileName:'private.vmd',id:'body',run:async()=>{ms=90;}}]);await task.run();ms=95;t.ready(true);
  expect(r.frame('floor')).toBeUndefined();ms=110;const e=r.frame('classroom');expect(e).toEqual({from:'lawn',to:'classroom',success:true,entryToVisibleFrameMs:110,preQueueMs:20,queueToReadyMs:75,readyToFrameMs:15,taskWallMs:{body:70},modelWork:[]});expect(r.frame('classroom')).toBeUndefined();
});
