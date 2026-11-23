import {expect,it} from 'vitest';
import type {ConceptionEvent} from './game';
import {createPictureClock,PICTURE_END} from './pictureClock';

const result:ConceptionEvent={id:1,chance:60,success:true,side:-1,at:1000};

it('samples the delivery timestamp across open, freeze, resume and view replacement',()=>{
  const lens=createPictureClock();
  expect(lens(undefined,950,true)).toBe(PICTURE_END);
  expect(lens(result,995,true)).toBe(0); // callback timestamp can slightly precede delivery
  expect(lens(result,5000,true)).toBe(4);
  expect(lens({...result},7000,false)).toBe(4);
  expect(lens(result,8000,true)).toBe(7);
  expect(createPictureClock()(result,8000,true)).toBe(7);
  expect(createPictureClock()(result,26000,true)).toBe(PICTURE_END);
});

it('settles a result first seen paused; only a different event can start a fresh picture',()=>{
  const lens=createPictureClock();
  expect(lens(result,2000,false)).toBe(PICTURE_END);
  expect(lens(result,3000,true)).toBe(PICTURE_END);
  expect(lens({...result,id:2,at:3000,success:false},3500,true)).toBe(.5);
});
