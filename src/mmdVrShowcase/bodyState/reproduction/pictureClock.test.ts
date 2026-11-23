import {expect,it} from 'vitest';
import {DEFAULT_BODY_PROFILE as p} from '../data';
import {receiveDose,progressDays,startGame,reproductiveSample} from './game';
import {PICTURE_END,createPictureClock,pictureCue,recordPictureTransition} from './pictureClock';

it('freezes a lens pose, not the trial: switching observer samples current age; neither resume nor a repeated receipt plays old time',()=>{
  const open=startGame('asset-1',{...p,day:15}),done=receiveDose(open);
  recordPictureTransition(open,done,1000);const cue=pictureCue(done),visible=createPictureClock();expect(cue).toBeDefined();
  expect(visible(cue,5000,true)).toBe(4);expect(visible(cue,7000,false)).toBe(4);
  recordPictureTransition(open,done,7500);expect(pictureCue(done)).toBe(cue);expect(visible(cue,8000,true)).toBe(7);
  const otherView=createPictureClock();expect(otherView(cue,8000,true)).toBe(7);expect(createPictureClock()(cue,26000,true)).toBe(PICTURE_END);
  const frozenOnArrival=createPictureClock();expect(frozenOnArrival(cue,3000,false)).toBe(PICTURE_END);expect(frozenOnArrival(cue,4000,true)).toBe(PICTURE_END);
  expect(reproductiveSample(done)).toMatchObject({day:15,stage:'fertilized',gestation:0});
});
it.each([['asset-1','pregnant'],['asset-5','notImplanted']] as const)('reveals the attachment cue for %s only at the actual phase change', (id,stage)=>{
  const open=startGame(id,{...p,day:15}),done=receiveDose(open);recordPictureTransition(open,done,10);
  const transit=progressDays(done,2,p),cavity=progressDays(done,4,p),resolved=progressDays(done,6,p);
  expect(pictureCue(transit)).toBeUndefined();expect(pictureCue(cavity)).toBeUndefined();expect(pictureCue(resolved)).toBeUndefined();
  recordPictureTransition(cavity,resolved,30000);expect(pictureCue(resolved)?.at).toBe(30000);expect(reproductiveSample(resolved).stage).toBe(stage);
  const tomorrow=progressDays(resolved,1,p);recordPictureTransition(resolved,tomorrow,60000);expect(pictureCue(tomorrow)).toBeUndefined();
});
