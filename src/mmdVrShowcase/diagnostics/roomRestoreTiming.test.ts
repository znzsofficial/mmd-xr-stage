import {it,expect} from 'vitest';
import {createRoomRestoreTiming} from './roomRestoreTiming';
it('records a completed visit on its first visible frame only; a late completion cannot finish a different generation',async()=>{
  let ms=0;const r=createRoomRestoreTiming(()=>ms);r.begin('classroom','seasideTerminus',false);expect(r.bind('seasideTerminus')).toBeUndefined();
  r.begin('seasideTerminus','classroom',true);const obsolete=r.bind('classroom')!;r.cancel();r.begin('seasideTerminus','classroom',true);
  obsolete.ready(true);expect(r.frame('classroom')).toBeUndefined();const t=r.bind('classroom')!;ms=20;
  const [task]=t.wrap([{phase:'body',fileName:'private.vmd',id:'body',run:async()=>{t.motionWork.push({slot:'body',cache:'hit',loadWallMs:2,setAnimationMs:64});ms=90;}}]);await task.run();ms=95;t.ready(true);
  expect(r.frame('floor')).toBeUndefined();ms=110;const e=r.frame('classroom');t.motionWork[0].cache='miss';expect(e).toEqual({from:'seasideTerminus',to:'classroom',success:true,entryToVisibleFrameMs:110,preQueueMs:20,queueToReadyMs:75,readyToFrameMs:15,taskWallMs:{body:70},modelWork:[],motionWork:[{slot:'body',cache:'hit',loadWallMs:2,setAnimationMs:64}]});expect(r.frame('classroom')).toBeUndefined();
});
