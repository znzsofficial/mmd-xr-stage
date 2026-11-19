import {ThreeMmdLoader, type ThreeMmdAnimation} from '@yohawing/three-mmd-loader';

/** One viewing session, across its rooms. Only immutable parsed tracks are
 * shared. Each model binds them to its own evaluator / pose / physics world. */
export function createRoomMotionCache(parse=(file:File)=>new ThreeMmdLoader().loadAnimation(file)) {
  const clips=new Map<File,Promise<ThreeMmdAnimation>>();
  // Bounds are on source byte volume, not an estimate of JS heap usage.
  const budget=4*1024*1024;
  let bytes=0;
  return {
    load(file:File){
      const hit=clips.get(file);
      if(hit){clips.delete(file);clips.set(file,hit);return hit;}
      if(file.size>budget)return parse(file);
      while(clips.size>=4||bytes+file.size>budget){
        const oldest=clips.keys().next().value!;
        clips.delete(oldest);bytes-=oldest.size;
      }
      const next=parse(file).catch(error=>{
        if(clips.get(file)===next){clips.delete(file);bytes-=file.size;}
        throw error;
      });
      clips.set(file,next);bytes+=file.size;return next;
    },
    clear(){clips.clear();bytes=0;},
  };
}
export type RoomMotionCache=ReturnType<typeof createRoomMotionCache>;
