import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { Vector3 } from 'three';
import { useBackpack } from '../../backpack';
import { useHudWorldInput } from '../../components/hudWorldInput';
import { useMmdVrStore } from '../../mmdVrStore';
import type { SceneryId } from '../catalog';

type Mode = 'blocked' | 'screen' | 'xr';
type Sight = (from: Vector3, hit: Vector3) => boolean;
export const sceneActionRays = { allow: ['ray', 'mouse', 'screen-mouse'] };

function modeFor(room: SceneryId): Mode {
  const s = useMmdVrStore.getState(), b = useBackpack.getState();
  if (!s.overlayOpen || s.prefs.scenery !== room || b.draft || b.busy || s.physicsBusy || s.physicsFatal || s.assetLoad.running) return 'blocked';
  if (s.presentation === 'xr') return useHudWorldInput.getState().blocked ? 'blocked' : 'xr';
  return 'screen';
}

function useActionMode(room: SceneryId, onChange?: () => void) {
  const read = useCallback(() => modeFor(room), [room]);
  const subscribe = useCallback((notify: () => void) => {
    let previous = read();
    const check = () => {
      const next = read();
      if (next === previous) return;
      previous = next;
      // Revoke a held trigger even if both the block and unblock occur in a
      // single React batch, with no rendered 'blocked' frame in between.
      onChange?.(); notify();
    };
    const off = [useMmdVrStore.subscribe(check), useBackpack.subscribe(check), useHudWorldInput.subscribe(check)];
    return () => off.forEach(stop => stop());
  }, [read,onChange]);
  return useSyncExternalStore(subscribe,read,read);
}

/** For moving scenery that also intercepts rays (e.g. fabric in front of the actor). */
export function useSceneActionsEnabled(room: SceneryId) { return useActionMode(room) !== 'blocked'; }

/** An in-world switch, not a drag or grab. The room owns its action and its
 * finite sightline. Only the target that accepted a press can act on release. */
export function useSceneAction(room: SceneryId, sight: Sight, activate: () => void) {
  const owner = useRef<number | null>(null), [over] = useState(() => new Set<number>());
  const [hovered,setHovered] = useState(false);
  const reset = useCallback(() => { owner.current = null; over.clear(); setHovered(false); }, [over]);
  const mode = useActionMode(room,reset);
  const cancel = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerId === owner.current) owner.current = null;
    if (over.delete(e.pointerId)) setHovered(over.size > 0);
  };
  return { hovered, enabled: mode !== 'blocked', bindings: {
    pointerEvents: mode === 'blocked' ? 'none' as const : 'auto' as const,
    pointerEventsType: sceneActionRays,
    onPointerEnter(e: ThreeEvent<PointerEvent>) {
      if (modeFor(room) === 'blocked' || !sight(e.ray.origin,e.point)) return;
      e.stopPropagation(); over.add(e.pointerId); setHovered(true);
    },
    onPointerLeave: cancel, onPointerCancel: cancel,
    onPointerDown(e: ThreeEvent<PointerEvent>) {
      if (modeFor(room) !== 'xr' || !sight(e.ray.origin,e.point)) return;
      e.stopPropagation(); owner.current ??= e.pointerId;
    },
    onPointerUp(e: ThreeEvent<PointerEvent>) {
      if (owner.current !== e.pointerId) return;
      owner.current = null; e.stopPropagation();
      if (modeFor(room) === 'xr' && sight(e.ray.origin,e.point)) activate();
    },
    onClick: mode === 'screen' ? (e: ThreeEvent<MouseEvent>) => {
      if (modeFor(room) !== 'screen' || e.button !== 0 || e.delta >= 5 || !sight(e.ray.origin,e.point)) return;
      e.stopPropagation(); activate();
    } : undefined,
  } };
}
