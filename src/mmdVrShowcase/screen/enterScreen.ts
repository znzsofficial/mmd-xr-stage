import { prepareBackpackEntry, useBackpack } from '../backpack';
import { beginMmdVrAssetSession } from '../mmdVrAssets';
import { useMmdVrStore } from '../mmdVrStore';

/** A viewer of the same page-owned stage. No XR session, generation or frame report. */
export function enterScreen() {
  const state = useMmdVrStore.getState();
  if (state.overlayOpen || state.phase === 'entering' || state.phase === 'active') return;
  const room = state.prefs.scenery;
  const snapshot = useBackpack.getState().layouts[room] ?? (state.savedStage?.scenery === room ? state.savedStage : null);
  prepareBackpackEntry(true);
  state.prepareStage(false);
  useMmdVrStore.setState({resumeStage:snapshot, physicsEnabled:snapshot?.physicsEnabled ?? false,
    physicsControllerCollisions:snapshot?.controllerCollisions ?? true, phase:'idle'});
  beginMmdVrAssetSession(snapshot?.assets ?? []);
  state.openOverlay('screen');
}
