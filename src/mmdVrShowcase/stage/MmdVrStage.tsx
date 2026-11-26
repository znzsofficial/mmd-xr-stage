import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import {useThree} from '@react-three/fiber';
import { useBackpack } from '../backpack/store';
import { createRoomAlphaTiles } from '../mmdRuntime/roomAlphaTiles';
import { createRoomMotionCache } from '../mmdRuntime/roomMotionCache';
import { getMmdVrSessionAssets } from '../backpack/sessionAssets';
import { useMmdVrStore } from '../mmdVrStore';
import { MmdVrStageRoom } from './StageRoom';
import type { RoomActorBackend } from './createRoomRuntime';

const hosts=new WeakMap<object,number>();
let nextHost=0;
function hostId(host:object){
  let id=hosts.get(host);
  if(id===undefined){id=++nextHost;hosts.set(host,id);}
  return id;
}

/** One viewing session keeps decoded data across visits, but mounts only the
 * current room. Both screen and XR enter the stage through this component. */
export function MmdVrStageContent({backend}:{backend?:RoomActorBackend} = {}) {
  const gl=useThree(s=>s.gl), scene=useThree(s=>s.scene);
  const motionCache = useMemo(() => createRoomMotionCache(), []);
  const alphaTiles = useMemo(() => createRoomAlphaTiles(), []);
  useEffect(() => {
    const unsubscribe = useBackpack.subscribe((s, prev) => {
      if (s.files === prev.files) return;
      const retained = new Set(s.files);
      for (const file of prev.files) if (!retained.has(file)) motionCache.release(file);
    });
    return () => { unsubscribe(); motionCache.clear(); alphaTiles.clear(); };
  }, [motionCache, alphaTiles]);

  const scenery = useMmdVrStore(s => s.prefs.scenery);
  // Even a batched A→B→A switch must retire A's old commands and loaders.
  const [generation, advance] = useReducer(n => n + 1, 0);
  useLayoutEffect(() => useMmdVrStore.subscribe((s, prev) => {
    if (s.prefs.scenery !== prev.prefs.scenery) advance();
  }), []);

  const initial = useRef({ scenery, saved: useMmdVrStore.getState().resumeStage, slots: getMmdVrSessionAssets() });
  const entry = initial.current.scenery === scenery ? initial.current : null;
  const saved = useBackpack.getState().layouts[scenery] ?? entry?.saved ?? null;
  const slots = saved?.assets ?? entry?.slots ?? [];
  // Renderer or scene replacement retires *all* room-owned objects and load
  // tasks. A camera change (including XR eye cameras) does not retire a room.
  return <MmdVrStageRoom key={`${scenery}:${generation}:${hostId(gl)}:${hostId(scene)}`} scenery={scenery} saved={saved} slots={slots}
    motionCache={motionCache} alphaTiles={alphaTiles} backend={backend}/>;
}
