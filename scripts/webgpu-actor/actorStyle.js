import { disposeActorStyleMaps, loadActorStyleMaps } from './actorStyleMaps.js';
import { actorStyleMode } from './actorStyleSlots.js';

/** Lifetime: one attachment, not one file basename, style click or VMD. The
 * worker produces mail; only frame() may install a graph on a live model. */
export function createActorStyle(model, source, plan, adapter, notify, load = loadActorStyleMaps) {
  const abort = new AbortController();
  const slots = Object.fromEntries(Object.entries(plan.hybridSlots).map(([k,v])=>[k,v.length]));
  let state = { phase:plan.hasBase ? 'available' : 'unavailable', requested:'mmd', mode:'mmd',
    slots, clothMaps:0, faceMaps:0, hairMasks:0, failedModes:[] };
  const choices = new Map();
  function publish(patch) { state = {...state,...patch}; notify(); }
  async function read(mode, choice, inputs) {
    try {
      const result = await load(source,inputs,abort.signal);
      if (abort.signal.aborted) { disposeActorStyleMaps(result); return; }
      choice.maps = result; // Cache on this attachment, even if the user changed mode again.
    } catch {
      // Even a broken optional decoder leaves the named base materials usable.
      if (abort.signal.aborted) return;
    }
    choice.phase = 'ready';
    const counts = mode === 'strinova' ? {hairMasks:choice.maps?.hair?.size ?? 0} :
      {clothMaps:choice.maps?.cloth?.size ?? 0,faceMaps:choice.maps?.face?.size ?? 0};
    publish(state.requested === mode ? {...counts,phase:'ready'} : counts);
  }
  return {
    get snapshot() { return state; },
    choose(value) {
      const requested = actorStyleMode(value);
      if (abort.signal.aborted || !plan.hasBase || requested === state.requested || state.failedModes.includes(requested)) return;
      if (requested === 'mmd') { publish({requested,phase:'ready'}); return; }
      if (requested !== 'endfield' && requested !== 'strinova') return;
      const cached = choices.get(requested);
      if (cached) { publish({requested,phase:cached.phase}); return; }
      const inputs = requested === 'endfield' ? plan.inputs : plan.hairInputs ?? [];
      // The basic Strinova graph never needs the Endfield decoder's face or cloth maps.
      const needsMaps = source && inputs.length && (requested === 'endfield' || source.companionFiles?.some(f=>/\.strand-mask\.png$/i.test(f.name)));
      const choice = {phase:needsMaps ? 'loading' : 'ready'};
      choices.set(requested,choice); publish({requested,phase:choice.phase});
      if (needsMaps) void read(requested,choice,inputs);
    },
    frame() {
      if (abort.signal.aborted || state.phase !== 'ready' || state.mode === state.requested) return false;
      try {
        const choice = choices.get(state.requested);
        if (choice && !adapter.prepareStyle(model,choice.maps,state.requested)) throw Error('Unavailable style');
        if (!adapter.setStyle(model,state.requested)) throw Error('Unavailable style');
        publish({mode:state.requested});
      } catch {
        // Optional graph failure is not a room or actor failure. The adapter
        // owns any partly prepared graph and releases it on normal detach.
        try { adapter.setStyle(model,'mmd'); } catch { /* retain the baseline */ }
        publish({phase:'failed',failedModes:[...state.failedModes,state.requested],requested:'mmd',mode:'mmd'});
      }
      return true;
    },
    // Called after adapter.detach; a later worker reply can only release itself.
    dispose() { abort.abort(); for (const choice of choices.values()) disposeActorStyleMaps(choice.maps); choices.clear(); },
  };
}
