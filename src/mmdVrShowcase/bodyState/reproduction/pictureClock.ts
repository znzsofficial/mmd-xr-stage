import type {ConceptionEvent} from './game';

export const PICTURE_END=12;
// A settled result can be named once the illustrated fusion beat has finished.
export const RESULT_REVEAL_SECONDS=8.54;

/** The picture reads event age on the frame's monotonic clock, in seconds.
 * Freezing holds an existing frame; opening frozen shows the settled result. */
export function createPictureClock(){
  let owner:number|undefined,age=PICTURE_END;
  return (event:ConceptionEvent|undefined,now:number,moving:boolean)=>{
    if(event?.id!==owner){owner=event?.id;age=moving&&event?0:PICTURE_END;}
    if(event&&moving)age=Math.max(age,Math.min(PICTURE_END,(now-event.at)/1000));
    return age;
  };
}
