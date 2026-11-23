import {stageOf,type ReproductionGame} from './game';

/** Ephemeral presentation timestamps. Only the outcome transition can emit
 * its cue; these seconds never participate in the game clock or its odds. */
export const PICTURE_END=12;
type Cue={at:number};
type Pair={encounter:Cue;attachment?:Cue};
const cues=new WeakMap<NonNullable<ReproductionGame['trial']>,Pair>();
export function recordPictureTransition(before:ReproductionGame,after:ReproductionGame,at:number){
  const t=after.trial;if(!t)return;
  if(!before.trial){if(!cues.has(t))cues.set(t,{encounter:{at}});return;}
  if(t!==before.trial||after.day===before.day)return;
  const pair=cues.get(t),stage=stageOf(after);
  if(pair&&!pair.attachment&&(stage==='pregnant'||stage==='notImplanted')&&stageOf(before)!==stage)pair.attachment={at};
}
export function pictureCue(g:ReproductionGame){
  if(!g.trial)return;const pair=cues.get(g.trial);if(!pair)return;
  if(g.day===g.trial.day)return pair.encounter;
  if(g.day-g.trial.day===6)return pair.attachment;
}
export function createPictureClock(){
  let owner:Cue|undefined,age=PICTURE_END;
  return (cue:Cue|undefined,now:number,moving:boolean)=>{
    if(cue!==owner){owner=cue;age=moving&&cue?0:PICTURE_END;}
    // Re-opening samples current event age. A frozen observer receiving a
    // new result gets its settled image, never a replay on pressing Play.
    if(cue&&moving)age=Math.max(age,Math.min(PICTURE_END,Math.max(0,now-cue.at)/1000));
    return age;
  };
}
