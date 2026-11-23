import { useLayoutEffect, useState } from 'react';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { poseActions, usePoseSession } from './poseSession';
import { posePresets, type PosePresetId } from './presetCatalog';
import type { PoseText } from './poseText';

export type PoseControlsProps = { assetId: string; runtimeId: string; onBack?: () => void };
export type QuickPoseProps = PoseControlsProps & { t: PoseText; busy: boolean; canUndo: boolean; undo: () => boolean };
const empty: readonly string[] = [];
const begin = (assetId: string, runtimeId: string) =>
  !(useMmdVrStore.getState().presentation === 'xr' && useHudWorldInput.getState().blocked) && poseActions.begin(assetId, runtimeId);

/** Only mounted by an explicit visit to this actor's pose tools. Returning to another
 * character tool holds the pose; only Restore motion explicitly unbinds the edit. */
export function usePoseEditor({ assetId, runtimeId, onBack }: PoseControlsProps) {
  const state = usePoseSession();
  const owns = () => {
    const s = usePoseSession.getState();
    return s.assetId === assetId && s.runtimeId === runtimeId;
  };
  useLayoutEffect(() => {
    begin(assetId, runtimeId);
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
    undo: () => owns() && poseActions.undo(),
    begin: () => begin(assetId, runtimeId),
    leave: () => { poseActions.hold(assetId,runtimeId); onBack?.(); },
    restore: () => { if (owns()) poseActions.end(); onBack?.(); },
  };
}

/** The receipt describes the last press on this page, not a permanent preset selection. */
export function useQuickPoses({ assetId, runtimeId, t, busy, undo }: QuickPoseProps) {
  const [receipt, setReceipt] = useState<PosePresetId | 'undone' | 'unavailable' | null>(null);
  const choices = posePresets.map(p => ({ id: p.id, label: t.presetName(p), supported: poseActions.canPreset(p.id) }));
  const last = choices.find(p => p.id === receipt);
  const status = last ? `${t.applied} · ${last.label}` : receipt === 'undone' ? t.undone : receipt === 'unavailable' ? t.unavailable :
    !busy && choices.some(p => !p.supported) ? t.unsupported : '';
  return { choices, status,
    apply: (id: PosePresetId) => setReceipt(poseActions.applyPreset(assetId, runtimeId, id) ? id : 'unavailable'),
    undo: () => { if (undo()) setReceipt('undone'); },
  };
}
