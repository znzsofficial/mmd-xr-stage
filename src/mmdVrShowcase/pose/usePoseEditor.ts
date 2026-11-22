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
    return () => {
      const s = usePoseSession.getState();
      if (s.editing && s.assetId === assetId && s.runtimeId === runtimeId) {
        if (s.dragging) poseActions.finishDrag(true);
        poseActions.hold();
      }
    };
  }, [assetId, runtimeId]);
  const own = state.assetId === assetId && state.runtimeId === runtimeId;
  return {
    ...state, active: own && state.editing, held: own && !state.editing,
    savedNames: state.names[assetId] ?? empty,
    begin: () => poseActions.begin(assetId, runtimeId),
    leave: () => { if (owns() && usePoseSession.getState().editing) {
      if (usePoseSession.getState().dragging) poseActions.finishDrag(true);
      poseActions.hold();
    } onBack?.(); },
    restore: () => { if (owns()) poseActions.end(); onBack?.(); },
  };
}
