import { prepareBackpackEntry, useBackpack } from '../backpack';
import { beginMmdVrAssetSession } from '../mmdVrAssets';
import { useMmdVrStore } from '../mmdVrStore';
import { isSceneryId } from '../scenery/catalog';

/** Set links land on prep for file import / a user-initiated XR session.
 * Only an explicit screen link opens a viewer. Keep existing arcade bookmarks. */
export function openStageLink(query: URLSearchParams) {
  const legacyArcade = !query.has('set') && query.get('preview') === 'arcade';
  const scenery = legacyArcade ? 'arcadeHall' : query.get('set');
  if (!isSceneryId(scenery)) return;
  useMmdVrStore.getState().setPrefs({scenery});
  if (legacyArcade || query.get('view') === 'screen') enterScreen();
}

/** A viewer of the same page-owned stage. No XR session, generation or frame report. */
export function enterScreen() {
  const state = useMmdVrStore.getState();
  if (state.overlayOpen || state.phase === 'entering' || state.phase === 'active') return;
  const room = state.prefs.scenery;
  const snapshot = useBackpack.getState().layouts[room] ?? (state.savedStage?.scenery === room ? state.savedStage : null);
  prepareBackpackEntry(true);
  state.prepareStage(false);
  useMmdVrStore.setState({resumeStage:snapshot, physicsEnabled:snapshot?.physicsEnabled ?? false, phase:'idle'});
  beginMmdVrAssetSession(snapshot?.assets ?? []);
  state.openOverlay('screen');
}
