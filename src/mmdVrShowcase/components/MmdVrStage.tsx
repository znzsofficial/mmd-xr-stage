import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { useBackpack } from '../backpack';
import { createRoomAlphaTiles } from '../mmdRuntime/roomAlphaTiles';
import { createRoomMotionCache } from '../mmdRuntime/roomMotionCache';
import { getMmdVrSessionAssets } from '../mmdVrAssets';
import { useMmdVrStore } from '../mmdVrStore';
import { MmdVrStageRoom } from '../stage/StageRoom';

/** One viewing session keeps decoded data across visits, but mounts only the
 * current room. Both screen and XR enter the stage through this component. */
export function MmdVrStageContent() {
  const motionCache = useMemo(() => createRoomMotionCache(), []);
  const alphaTiles = useMemo(() => createRoomAlphaTiles(), []);
  useEffect(() => () => { motionCache.clear(); alphaTiles.clear(); }, [motionCache, alphaTiles]);

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
  return <MmdVrStageRoom key={`${scenery}:${generation}`} scenery={scenery} saved={saved} slots={slots}
    motionCache={motionCache} alphaTiles={alphaTiles}/>;
}
