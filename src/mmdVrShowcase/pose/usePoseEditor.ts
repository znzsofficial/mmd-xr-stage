import { useLayoutEffect } from 'react';
import { poseActions, usePoseSession } from './poseSession';

export type PoseControlsProps = { assetId: string; runtimeId: string; onBack?: () => void };
const empty: readonly string[] = [];

/** Only mounted by an explicit visit to this actor's pose tools. Returning to another
 * character tool holds the pose; only Restore motion explicitly unbinds the edit. */
export function usePoseEditor({ assetId, runtimeId, onBack }: PoseControlsProps) {
  const state = usePoseSession();
  const owns = () => {
    const s = usePoseSession.getState();
    return s.assetId === assetId && s.runtimeId === runtimeId;
  };
  useLayoutEffect(() => {
    poseActions.begin(assetId, runtimeId);
    return () => poseActions.hold(assetId,runtimeId);
  }, [assetId, runtimeId]);
  const own = state.assetId === assetId && state.runtimeId === runtimeId;
  const key = state.selected;
  const wrist = own && (key === 'leftHand' || key === 'rightHand') ? {
    pinned: state.pinnedWrists.includes(key), disabled: state.dragging || !poseActions.canBend(key),
    toggle: () => poseActions.setWristPinned(assetId, runtimeId, key, !state.pinnedWrists.includes(key)),
  } : null;
  return {
    ...state, active: own && state.editing, held: own && !state.editing, wrist,
    savedNames: state.names[assetId] ?? empty,
    save: (name:string) => owns() && poseActions.save(name),
    begin: () => poseActions.begin(assetId, runtimeId),
    leave: () => { poseActions.hold(assetId,runtimeId); onBack?.(); },
    restore: () => { if (owns()) poseActions.end(); onBack?.(); },
  };
}
