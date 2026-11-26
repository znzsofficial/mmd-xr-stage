import { disposeActorStyleMaps, loadActorStyleMaps } from './actorStyleMaps.js';

/** Lifetime: one attachment, not one file basename, style click or VMD. The
 * worker produces mail; only frame() may install a graph on a live model. */
export function createActorStyle(model, source, plan, adapter, notify, load = loadActorStyleMaps) {
  const abort = new AbortController();
  const slots = Object.fromEntries(Object.entries(plan.hybridSlots).map(([k,v])=>[k,v.length]));
  let state = { phase:plan.hasBase ? 'available' : 'unavailable', requested:'mmd', mode:'mmd',
    slots, clothMaps:0, faceMaps:0 };
  let maps, prepared = false;
  function publish(patch) { state = {...state,...patch}; notify(); }
  async function read() {
    try {
      const result = await load(source,plan.inputs,abort.signal);
      if (abort.signal.aborted) { disposeActorStyleMaps(result); return; }
      maps = result; // May be cached after a rapid return to original MMD.
      publish({phase:'ready', clothMaps:maps.cloth.size, faceMaps:maps.face.size});
    } catch {
      // Even a broken optional decoder leaves the named base materials usable.
      if (!abort.signal.aborted) publish({phase:'ready'});
    }
  }
  return {
    get snapshot() { return state; },
    choose(enabled) {
      const requested = enabled ? 'endfield' : 'mmd';
      if (abort.signal.aborted || ['unavailable','failed'].includes(state.phase) || requested === state.requested) return;
      if (enabled && state.phase === 'available') {
        if (source && plan.inputs.length) { publish({requested,phase:'loading'}); void read(); }
        else publish({requested,phase:'ready'});
      }
      else publish({requested});
    },
    frame() {
      if (abort.signal.aborted || state.phase !== 'ready' || state.mode === state.requested) return false;
      try {
        if (!prepared && !(prepared = adapter.prepareStyle(model,maps))) throw Error('Unavailable style');
        if (!adapter.setStyle(model,state.requested === 'endfield')) throw Error('Unavailable style');
        publish({mode:state.requested});
      } catch {
        // Optional graph failure is not a room or actor failure. The adapter
        // owns any partly prepared graph and releases it on normal detach.
        try { adapter.setStyle(model,false); } catch { /* retain the baseline */ }
        publish({phase:'failed',requested:'mmd',mode:'mmd'});
      }
      return true;
    },
    // Called after adapter.detach; a later worker reply can only release itself.
    dispose() { abort.abort(); disposeActorStyleMaps(maps); maps = undefined; },
  };
}
