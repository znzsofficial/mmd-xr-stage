import {ThreeMmdLoader, type ThreeMmdAnimation} from '@yohawing/three-mmd-loader';

/** One viewing session, across its rooms. Only immutable parsed tracks are
 * shared. Each model binds them to its own evaluator / pose / physics world. */
export function createRoomMotionCache(parse=(file:File)=>new ThreeMmdLoader().loadAnimation(file)) {
  const clips=new Map<File,{promise:Promise<ThreeMmdAnimation>;ready:boolean}>();
  // Bounds are on source byte volume, not an estimate of JS heap usage.
  const budget=4*1024*1024;
  let bytes=0;
  return {
    status(file:File) {
      const hit=clips.get(file);
      return hit ? (hit.ready ? 'hit' : 'pending') : (file.size>budget ? 'oversize' : 'miss');
    },
    load(file:File){
      const hit=clips.get(file);
      if(hit){clips.delete(file);clips.set(file,hit);return hit.promise;}
      if(file.size>budget)return parse(file);
      while(clips.size>=4||bytes+file.size>budget){
        const oldest=clips.keys().next().value!;
        clips.delete(oldest);bytes-=oldest.size;
      }
      const next={promise:parse(file),ready:false};
      next.promise=next.promise.then(animation=>{next.ready=true;return animation;},error=>{
        if(clips.get(file)===next){clips.delete(file);bytes-=file.size;}
        throw error;
      });
      clips.set(file,next);bytes+=file.size;return next.promise;
    },
    clear(){clips.clear();bytes=0;},
  };
}
export type RoomMotionCache=ReturnType<typeof createRoomMotionCache>;
