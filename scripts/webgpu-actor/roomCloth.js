import { fitRig } from '../../experiments/gpu-cloth/rig.js';
import { makeHandSamples } from '../../experiments/gpu-cloth/handSamples.js';
import { createClothSurface } from './clothSurface.js';
import { createClothDriver } from './clothDriver.js';

// Capture the authored mesh before the TSL facade replaces morph attributes
// and appends new material groups for outlines. No scene/mesh clone.
export function prepareRoomCloth(mesh) {
  const rig = fitRig(mesh);
  rig.handSamples = makeHandSamples(mesh, rig);
  return rig;
}

// The owning XR callback initializes the Three buffers and performs every
// dispatch. The pipeline's async compile only publishes a handle for later.
export function roomCloth(renderer, model, rig, log, gpuTiming) {
  let driver, surface, setup, retired = false, active = false, interrupted = true;
  const abort = new AbortController();
  log.cloth = 'waiting'; log.nodes = rig.nodes.length; log.handSamples = rig.handSamples.faces.length;
  function initialize() {
    try {
      surface = createClothSurface(renderer, model.mesh, rig);
      surface.setEnabled(false);
      log.cloth = 'preparing';
      setup = createClothDriver(renderer, model, rig, surface, abort.signal, gpuTiming).then(d => {
        if (retired) { d.dispose(); return; }
        driver = d; log.cloth = 'ready';
      }).catch(fail);
    } catch (error) { fail(error); }
  }
  function fail(e) {
    if (retired) return;
    log.cloth = 'failed'; log.clothError = String(e?.message ?? e);
    driver?.dispose(); driver = undefined; surface?.dispose(); surface = undefined;
  }
  function suspend() {
    if (active) { surface?.setEnabled(false); driver?.reset(); }
    active = false; interrupted = true;
  }
  return {
    get active() { return active; },
    // Split readiness from submission: the stage must choose its Bullet
    // topology *before* the model evaluates the pose used by the solver.
    ready(enabled) {
      if (!retired && enabled && !driver && !setup && log.cloth !== 'failed') initialize();
      return !!driver && !retired;
    },
    suspend,
    interrupt() { interrupted = true; },
    frame(dt, enabled, palms) {
      if (retired || log.cloth === 'failed') return;
      if (!driver) { if (enabled && !setup) initialize(); return; }
      try {
        if (!enabled) { suspend(); return; }
        if (!active || interrupted) driver.reset();
        active = true; interrupted = false;
        log.clothSteps += driver.step(dt, palms);
        surface.setEnabled(true);
      } catch (e) { fail(e); }
    },
    dispose() {
      retired = true; driver?.dispose(); abort.abort(); surface?.dispose();
      driver = surface = undefined;
    },
  };
}
