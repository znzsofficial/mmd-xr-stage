import { create } from 'zustand';
import { useBackpack } from '../backpack/store';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { recheckClothing } from './actions';

export type StockingSide = 'left' | 'right';
export type StockingTear = Readonly<{ side: StockingSide; u: number; v: number; du: number; dv: number }>;
export type StockingActor = Readonly<{ assetId: string; runtimeId: string }>;
type Pair = { worn: boolean; tears: readonly StockingTear[] };
type State = { actors: Record<string, Pair>; armed: StockingActor | null };
const original: Pair = { worn: false, tears: Object.freeze([]) };
export const useStockings = create<State>(() => ({ actors: {}, armed: null }));

export function readStockingState(assetId: string, state = useStockings.getState()): Pair {
  return state.actors[assetId] ?? original;
}

export function canDressStockings({ assetId, runtimeId }: StockingActor) {
  const b = useBackpack.getState(), s = useMmdVrStore.getState(), live = b.live[assetId];
  return s.overlayOpen && b.selected === assetId && live?.runtimeId === runtimeId && live.visible && !b.busy && !b.draft
    && !s.physicsBusy && !s.physicsFatal && !s.assetLoad.running && !s.pendingModelRemovals.includes(runtimeId)
    && !s.pendingVisibilityToggles.includes(runtimeId) && (s.presentation !== 'xr' || !useHudWorldInput.getState().blocked)
    && b.entries.some(e => e.kind === 'model' && e.id === assetId);
}

export function dressStockings(actor: StockingActor, action: 'wear' | 'remove' | 'replace') {
  if (!canDressStockings(actor)) return false;
  const state = useStockings.getState(), pair = readStockingState(actor.assetId, state);
  if (action === 'replace' ? !pair.worn || !pair.tears.length : pair.worn === (action === 'wear')) return false;
  const next: Pair = { worn: action !== 'remove', tears: action === 'replace' ? original.tears : pair.tears };
  useStockings.setState({ actors: { ...state.actors, [actor.assetId]: next }, armed: null });
  recheckClothing(actor.assetId);
  return true;
}

export function armStockingTear(actor: StockingActor) {
  if (!canDressStockings(actor) || !readStockingState(actor.assetId).worn) return;
  // Object identity is the lifetime of this explicit choice, even if a new
  // instance, room or clothing page has the same two IDs after a React batch.
  useStockings.setState({ armed: { assetId: actor.assetId, runtimeId: actor.runtimeId } });
}

export function disarmStockingTear(actor: StockingActor) {
  const { armed } = useStockings.getState();
  if (armed?.assetId === actor.assetId && armed.runtimeId === actor.runtimeId) useStockings.setState({ armed: null });
}

/** A requested pair may only be fitted after the next displayed room frame.
 * Keep its prior damage, but never present an unsupported actor as dressed. */
export function rejectStockingFit(actor: StockingActor) {
  if (useBackpack.getState().live[actor.assetId]?.runtimeId !== actor.runtimeId) return;
  const state = useStockings.getState(), pair = readStockingState(actor.assetId, state);
  if (!pair.worn) return;
  useStockings.setState({ actors: { ...state.actors, [actor.assetId]: { ...pair, worn: false } },
    armed: state.armed?.assetId === actor.assetId ? null : state.armed });
}

export function recordStockingTear(press: StockingActor, tear: StockingTear) {
  const state = useStockings.getState(), pair = readStockingState(press.assetId, state);
  if (state.armed !== press || !pair.worn || !canDressStockings(press) || (tear.side !== 'left' && tear.side !== 'right')
    || ![tear.u, tear.v, tear.du, tear.dv].every(Number.isFinite) || tear.u < 0 || tear.u > 1 || tear.v < 0 || tear.v > 1
    || Math.abs(tear.du) > .5 || tear.v + tear.dv < -1e-8 || tear.v + tear.dv > 1 + 1e-8 || Math.hypot(tear.du, tear.dv) < .012) return false;
  useStockings.setState({ actors: { ...state.actors, [press.assetId]: { worn: true, tears: [...pair.tears, { ...tear }] } } });
  recheckClothing(press.assetId);
  return true;
}

// Retain the pair when a room puts the actor away; only the file library
// owns it. The permission to tear never survives a selection or room change.
useBackpack.subscribe((bag, prev) => {
  const state = useStockings.getState();
  if (bag.entries !== prev.entries) {
    const kept = new Set(bag.entries.filter(e => e.kind === 'model').map(e => e.id));
    if (Object.keys(state.actors).some(id => !kept.has(id))) {
      useStockings.setState({ actors: Object.fromEntries(Object.entries(state.actors).filter(([id]) => kept.has(id))) });
    }
  }
  if (state.armed && !canDressStockings(state.armed)) disarmStockingTear(state.armed);
});

useMmdVrStore.subscribe((s, prev) => {
  const { armed } = useStockings.getState();
  if (armed && (s.entryEpoch !== prev.entryEpoch || s.prefs.scenery !== prev.prefs.scenery || s.runtimeRef !== prev.runtimeRef
    || s.materialModels[armed.runtimeId] !== prev.materialModels[armed.runtimeId] || s.viewEpoch !== prev.viewEpoch
    || s.presentation !== prev.presentation || !canDressStockings(armed))) disarmStockingTear(armed);
});
useHudWorldInput.subscribe(s => {
  const { armed } = useStockings.getState();
  if (armed && s.blocked && useMmdVrStore.getState().presentation === 'xr') disarmStockingTear(armed);
});
