import * as T from 'three/webgpu';
import { ThreeMmdLoader, disposeMmdModel } from '@yohawing/three-mmd-loader';
import { createLocalTextureResolver } from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import { firstCharacterScale } from '../../src/mmdVrShowcase/stage/loading/firstCharacterScale';
import { createActorMaterialAdapter } from './materialAdapter.js';
import { bindR187ProjectionOutput } from './r187ProjectionOutput.js';

const $ = id => document.getElementById(id);
const path = f => f.webkitRelativePath || f.name;
let current, last;
function phase(r, name) {
  r.log.phase = name;
  $('status').textContent = [name, r.log.error, r.log.actorError].filter(Boolean).join('\n');
}

function furnish(scene) {
  const add = (geometry, color, x, y, z) => {
    const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ color }));
    mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  };
  const floor = add(new T.PlaneGeometry(10, 10), 0x38474c, 0, -.01, -2);
  floor.rotation.x = -Math.PI / 2;
  add(new T.BoxGeometry(.13, 1.6, .13), 0xf57b29, -.56, .8, -1.25);
  add(new T.BoxGeometry(.18, 1.4, .18), 0x1fc4b8, .95, .7, -2.65);
  const light = new T.DirectionalLight(0xfff4e8, 1.1);
  light.position.set(-3, 4, 5); scene.add(light, new T.AmbientLight(0xffffff, .55));
  return light;
}

// Only the input File references outlive the attempt. A late PMX decode has no
// permission to attach to a new session. No physics world, stage store or clock.
async function loadActor(r, pmx, files) {
  let adapter, model;
  try {
    adapter = await createActorMaterialAdapter(r.renderer, r.light, {balancedModelColor:true, ambientIntensity:.55});
    if (r.closing) return;
    const loader = new ThreeMmdLoader({ textureResolver: createLocalTextureResolver(pmx, files),
      geometryAwareAlpha: true, runtime: { physics: 'none' } });
    model = await loader.loadModel(pmx, adapter.loadOptions);
    if (r.closing) return;
    model.root.scale.setScalar(firstCharacterScale(model.root) ?? .1);
    model.root.position.z = -1.85;
    model.root.updateMatrixWorld(true);
    adapter.attach(model);
    model.update(0, { physics: false, ik: false }); // one evaluated pose shared by both eyes
    r.log.evaluations++;
    model.root.updateMatrixWorld(true);
    r.scene.add(model.root);
    r.actor = { model, adapter }; model = adapter = null;
    r.log.actor = 'ready';
  } catch (e) {
    if (!r.closing) { r.log.actor = 'failed'; r.log.actorError = String(e); phase(r, 'landmarks'); }
  } finally {
    if (model) { adapter?.detach(model); disposeMmdModel(model, { textures: 'owned' }); }
    adapter?.dispose();
  }
}

function requestEnd(r) {
  if (r.session && !r.ended && !r.endTask) {
    r.endTask = Promise.resolve().then(() => r.session.end()).catch(e => { r.endFailed = true; r.log.error ??= `end: ${e}`; });
  }
}
function stop(r, error) {
  if (r !== current || r.closing) return;
  if (error) r.log.error = `${r.log.phase}: ${error}`;
  r.closing = true; clearTimeout(r.timer); r.wake(); requestEnd(r);
}

// Call from user activation. The XRManager owns the projection layer and the
// only XR RAF. We register the user's loop BEFORE setSession snapshots it.
async function enter(files = Array.from($('folder').files), pmx = files.find(f => path(f) === $('pmx').value)) {
  if (current) return;
  const r = current = { scene: new T.Scene(), log: { phase: 'request', actor: pmx ? 'selected' : 'none',
    landmarkFrames: 0, actorFrames: 0, evaluations: 0, rate72: 'unrequested' } };
  const finished = new Promise(ok => { r.wake = ok; });
  $('enter').disabled = $('folder').disabled = $('pmx').disabled = true; $('exit').disabled = false;
  phase(r, 'request');
  try {
    if (T.REVISION !== '187') throw Error(`Expected Three r187; got ${T.REVISION}`);
    if (!navigator.xr || !navigator.gpu || !globalThis.XRGPUBinding) throw Error('WebGPU XR binding unavailable');
    const s = r.session = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['webgpu', 'local-floor'], optionalFeatures: ['hand-tracking'],
    });
    r.endedEvent = new Promise(ok => s.addEventListener('end', () => { r.ended = true; stop(r); ok(); }, { once: true }));
    if (r.closing) return;
    if (!s.enabledFeatures?.includes('webgpu')) throw Error('Session did not enable webgpu');
    phase(r, 'init');
    const renderer = r.renderer = new T.WebGPURenderer({ antialias: false });
    renderer.xr.enabled = true; // WebGPUBackend.init passes this as requestAdapter({xrCompatible})
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.onError = info => stop(r, `${info.type}: ${info.message}`);
    renderer.onDeviceLost = info => stop(r, `device lost: ${info.message}`);
    await renderer.init();
    if (r.closing) return;
    if (!renderer.backend.isWebGPUBackend) throw Error('Three selected the WebGL fallback');
    r.restoreProjection = bindR187ProjectionOutput(renderer);
    renderer.setClearColor(0x162028, 1);
    r.light = furnish(r.scene);
    const camera = new T.PerspectiveCamera(60, 1, .05, 30);
    await renderer.setAnimationLoop((_time, frame) => {
      if (r.closing || !frame || frame.session !== s || !renderer.xr.isPresenting) return;
      try {
        if (!frame.getViewerPose(renderer.xr.getReferenceSpace())?.views.length) return;
        if (r.actor) r.actor.adapter.prepare(r.scene); // synchronous in the locked loader
        renderer.render(r.scene, camera); // never defer an XR draw across an await
        clearTimeout(r.timer);
        if (r.actor) {
          if (++r.log.actorFrames === 1) phase(r, 'actor');
        } else if (++r.log.landmarkFrames === 1) {
          phase(r, 'landmarks');
          if (pmx) { r.log.actor = 'loading'; void loadActor(r, pmx, files); }
        }
      } catch (error) { stop(r, error); }
    });
    if (r.closing) return;
    phase(r, 'bind');
    r.timer = setTimeout(() => stop(r, Error('No first tracked draw within 15 s')), 15000);
    await renderer.xr.setSession(s);
    if (r.closing) return;
    phase(r, 'awaiting-frame');
    if (s.supportedFrameRates?.includes(72) && s.updateTargetFrameRate) {
      r.log.rate72 = 'pending';
      try { s.updateTargetFrameRate(72).then(() => { if (!r.closing) r.log.rate72 = 'ok'; }, () => { if (!r.closing) r.log.rate72 = 'rejected'; }); }
      catch { r.log.rate72 = 'rejected'; }
    }
    await finished;
  } catch (e) { stop(r, e); }
  finally {
    r.closing = true; clearTimeout(r.timer); requestEnd(r);
    try {
      if (r.endTask) await r.endTask;
      if (r.session && !r.ended && !r.endFailed) await r.endedEvent;
      if (r.actor) {
        const { model, adapter } = r.actor;
        r.scene.remove(model.root); adapter.detach(model); disposeMmdModel(model, { textures: 'owned' }); adapter.dispose();
      }
      r.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      r.restoreProjection?.(); await r.renderer?.dispose();
    } catch (e) { r.log.error ??= `cleanup: ${e}`; }
    r.log.endObserved = !!r.ended; phase(r, r.log.error ? 'failed' : 'ended');
    current = null; last = r.log;
    $('enter').disabled = $('folder').disabled = $('pmx').disabled = false; $('exit').disabled = true;
  }
}

$('folder').onchange = () => {
  const models = Array.from($('folder').files).filter(f => /\.pmx$/i.test(f.name));
  $('pmx').replaceChildren(new Option('空房间', ''), ...models.map(f => new Option(path(f), path(f))));
  if (models.length === 1) $('pmx').selectedIndex = 1;
};
$('enter').onclick = () => { void enter(); };
$('exit').onclick = () => { if (current) stop(current); };
// Also catch an exception inside XRManager before it calls our frame function.
window.addEventListener('error', e => { if (current && e.error) stop(current, e.error); });
window.addEventListener('pagehide', () => { if (current) stop(current); });
window.xrRoom = { enter, get status() { return current?.log ?? last ?? { phase: 'idle' }; } };
