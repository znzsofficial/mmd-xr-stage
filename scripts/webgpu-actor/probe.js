import * as T from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { ThreeMmdLoader, disposeMmdModel, syncMmdSpecularDirection } from '@yohawing/three-mmd-loader';
import { createLocalTextureResolver } from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import { applyMaterialOverrides } from '../../src/mmdVrShowcase/mmdRuntime/mmdRuntimeMaterials';
import { materialSlotKeys } from '../../src/mmdVrShowcase/mmdRuntime/materialSlotKey';
import { prepareMmdVrModel } from '../../src/mmdVrShowcase/stage/loading/prepareMmdVrModel';
import { firstCharacterScale } from '../../src/mmdVrShowcase/stage/loading/firstCharacterScale';
import { createActorMaterialAdapter } from './materialAdapter.js';

const SIZE = 600, AMBIENT = .55;
const $ = id => document.getElementById(id);
const path = f => f.webkitRelativePath || f.name;
const inputFiles = () => [...$('folder').files, ...$('motion').files];
const materials = mesh => [mesh.material].flat();

function pick(files, selector, type) {
  const candidates = files.filter(f => type.test(f.name));
  if (selector == null && candidates.length === 1) return candidates[0];
  const matches = candidates.filter(f => f === selector || path(f) === selector || f.name === selector);
  if (matches.length !== 1) throw Error(`Select one ${type === PMX ? 'PMX' : 'VMD/VPD'} (use its directory-relative path for duplicate names).`);
  return matches[0];
}
const PMX = /\.pmx$/i, CLIP = /\.(vmd|vpd)$/i;

// Fixed to bind geometry, never re-fit to one backend's evaluated/deformed pixels.
function framing(model, scale = firstCharacterScale(model.root) ?? 1) {
  const box = new T.Box3().setFromBufferAttribute(model.mesh.geometry.getAttribute('position'));
  const height = box.max.y - box.min.y, center = box.getCenter(new T.Vector3()).multiplyScalar(scale);
  const eye = center.clone().addScaledVector(new T.Vector3(.18, .06, 1.7), height * scale);
  return { scale, eye: eye.toArray(), center: center.toArray() };
}

function prepareWebGL(model, light) {
  prepareMmdVrModel(model.root);
  syncMmdSpecularDirection(model.mesh.material, light);
  applyMaterialOverrides({ model, id: 'probe', materialNames: materialSlotKeys(materials(model.mesh)), materialOverrides: Object.create(null) }, {
    balancedModelColor: true, envIntensity: 0, ambientIntensity: AMBIENT,
    lightIntensity: light.intensity, lightColor: light.color, lightDirection: light.position.clone().normalize(),
  });
}

function poseVector(mesh) {
  return [...mesh.skeleton.bones.flatMap(b => b.matrix.elements), ...(mesh.morphTargetInfluences ?? [])];
}
function maxDelta(a, b) {
  if (a.length !== b.length) throw Error('Pose dimensions differ');
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  if (!Number.isFinite(max)) throw Error('Invalid evaluated pose');
  return max;
}

function snapshot(renderer, scene, camera) {
  renderer.render(scene, camera);
  // Copy in the submitting task, before the browser presents/recycles the swap texture.
  const copy = document.createElement('canvas'); copy.width = copy.height = SIZE;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(renderer.domElement, 0, 0);
  return { copy, pixels: ctx.getImageData(0, 0, SIZE, SIZE).data };
}
function changedPixels(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2] || a[i+3] !== b[i+3]) changed++;
  return changed;
}

async function draw(gpu, input, common) {
  const params = { alpha: true, antialias: false };
  const renderer = gpu ? new WebGPURenderer(params) : new T.WebGLRenderer(params);
  const scene = new T.Scene(), light = new T.DirectionalLight(0xfff4e8, 1.1);
  light.position.set(-3, 4, 5);
  if (input.lightYaw != null) {
    const a = T.MathUtils.degToRad(input.lightYaw), r = Math.hypot(light.position.x, light.position.z);
    light.position.set(Math.sin(a) * r, light.position.y, Math.cos(a) * r);
  }
  scene.add(light, new T.AmbientLight(0xffffff, AMBIENT));
  let gpuError;
  if (gpu) renderer.onError = info => { gpuError ??= new Error(`WebGPU ${info.type}: ${info.message}`); };
  let adapter, model;
  try {
    if (gpu) adapter = await createActorMaterialAdapter(renderer, light); // rejects WebGL fallback
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
    model = await input.loader.loadModel(input.pmx, adapter?.loadOptions);
    const source = materials(model.mesh), slotCount = source.length;
    if (input.hideSlot != null && (!Number.isInteger(input.hideSlot) || input.hideSlot < 0 || input.hideSlot >= slotCount)) throw Error('hideSlot must be an authored PMX slot index');
    const slots = model.diagnostics.materials.map(({ materialIndex: i, pmxTransparencyMode, textureTransparencyMode, finalTransparencyMode }) => ({
      index: i, textured: !!source[i].map, edge: !!source[i].userData.mmdMaterial?.flags?.edge,
      pmxAlpha: pmxTransparencyMode, textureAlpha: textureTransparencyMode ?? null, resolvedAlpha: finalTransparencyMode,
    }));
    const frame = common.frame ??= framing(model, input.scale ?? undefined);
    const camera = new T.PerspectiveCamera(35, 1, .005 * frame.scale, 1500 * frame.scale);
    camera.position.fromArray(frame.eye); camera.lookAt(...frame.center); camera.updateMatrixWorld();
    scene.add(model.root); model.root.scale.setScalar(frame.scale); model.root.updateMatrixWorld(true);
    const bind = poseVector(model.mesh);
    if (adapter) await adapter.attach(model);
    if (input.clip) model.setAnimation(input.clip);
    const evaluated = model.update(input.time, { physics: false, ik: !!input.clip });
    model.root.updateMatrixWorld(true);
    const pose = poseVector(model.mesh), poseDeltaFromBind = maxDelta(pose, bind);
    const poseDeltaFromGL = maxDelta(pose, common.pose ??= pose);
    if (poseDeltaFromGL > 1e-5) throw Error(`CPU bone/morph poses differ by ${poseDeltaFromGL}`);
    if (adapter) await adapter.prepare(scene); else prepareWebGL(model, light);
    const evaluatedMaterials = materials(model.mesh);
    for (const slot of slots) {
      const m = evaluatedMaterials[slot.index];
      Object.assign(slot, { opacity: m.opacity, transparent: m.transparent, alphaTest: m.alphaTest, depthWrite: m.depthWrite });
    }

    // Map actual draws (including split-body/proxy draws) to original slots.
    // TSL appends edge materials to the list; they are not additional PMX slots.
    const edges = new Set();
    model.root.traverse(o => {
      if (!o.isMesh) return;
      for (const m of materials(o)) {
        const edge = m.userData.mmdTslOutlineMaterial ?? m.userData.mmdOutlineMaterial;
        if (edge) edges.add(m);
        const slot = edge?.sourceMaterialIndex ?? m.userData.mmdMaterial?.materialIndex ?? o.userData.mmdMaterialRenderProxy?.materialIndex;
        if (input.hideSlot != null && slot === input.hideSlot) m.visible = false;
      }
    });
    const shot = snapshot(renderer, scene, camera), info = renderer.info.render;
    const drawCalls = info.drawCalls ?? info.calls;
    let visiblePixels = 0, partialAlphaPixels = 0;
    for (let i = 3; i < shot.pixels.length; i += 4) {
      if (shot.pixels[i]) visiblePixels++;
      if (shot.pixels[i] > 0 && shot.pixels[i] < 255) partialAlphaPixels++;
    }
    if (visiblePixels < 60) throw Error(`${gpu ? 'WebGPU' : 'WebGL'}: no actor visible in the fixed camera`);
    // Same evaluated pose, camera and material state; turn off only authored edge draws.
    const activeEdges = [...edges].filter(m => m.visible);
    for (const m of activeEdges) m.visible = false;
    const outlineChangedPixels = activeEdges.length ? changedPixels(shot.pixels, snapshot(renderer, scene, camera).pixels) : 0;
    if (gpu) {
      await renderer.backend.device.queue.onSubmittedWorkDone();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (gpuError) throw gpuError;
    }
    else {
      const gl = renderer.getContext();
      for (const p of renderer.info.programs) if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) throw Error('WebGL program failed to link');
    }
    return { image: shot.copy.toDataURL('image/png'), metrics: { ...frame, time: input.time, lightPosition: light.position.toArray(), evaluatedFrame: evaluated.frame, poseDeltaFromBind, poseDeltaFromGL,
      visiblePixels, partialAlphaPixels, outlineDrawMaterials: activeEdges.length, outlineChangedPixels, drawCalls, slots,
      textureWarnings: model.diagnostics.textures.map(({ code, materialIndex }) => ({ code, materialIndex })),
    } };
  } finally {
    if (model) { adapter?.detach(model); disposeMmdModel(model, { textures: 'owned' }); }
    adapter?.dispose(); await renderer.dispose(); renderer.forceContextLoss?.();
  }
}

// Selectors accept a File in files, an exact relative path or a unique basename.
// Omit vmd for bind pose; pass a .vpd via pose instead. hideSlot is zero-based.
let busy = false;
window.compareActor = async ({ files = inputFiles(), pmx, vmd, pose, time = 0, scale, hideSlot, lightYaw } = {}) => {
  if (busy) throw Error('A comparison is running');
  if (!Number.isFinite(time) || time < 0 || (scale != null && (!Number.isFinite(scale) || scale < .01 || scale > 10))) throw Error('Invalid time or placement scale');
  if (lightYaw != null && !Number.isFinite(lightYaw)) throw Error('Invalid light angle');
  busy = true; $('run').disabled = true; $('summary').textContent = '';
  for (const id of ['webgl', 'webgpu']) $(id).removeAttribute('src');
  try {
    const all = Array.from(files), file = pick(all, pmx, PMX);
    const loader = new ThreeMmdLoader({ textureResolver: createLocalTextureResolver(file, all), geometryAwareAlpha: true, runtime: { physics: 'none' } });
    const selected = pose ?? vmd, motion = selected ? pick(all, selected, CLIP) : null;
    const clip = !motion ? null : /\.vpd$/i.test(motion.name) ? await loader.loadPoseAnimation(motion) : await loader.loadAnimation(motion);
    const input = { pmx: file, loader, clip, time, scale, hideSlot, lightYaw }, common = {}, result = {};
    for (const id of ['webgl', 'webgpu']) {
      $('status').textContent = `渲染 ${id}…`;
      result[id] = await draw(id === 'webgpu', input, common); $(id).src = result[id].image;
      $('summary').textContent += `${id}: ${JSON.stringify(result[id].metrics, (k, v) => k === 'slots' ? v.length : v)}\n`;
    }
    $('status').textContent = '对照完成'; return result;
  } catch (err) { $('status').textContent = String(err); throw err; }
  finally { busy = false; $('run').disabled = false; }
};

function choices() {
  const files = inputFiles(), options = type => files.filter(f => type.test(f.name)).map(f => new Option(path(f), path(f)));
  $('pmx').replaceChildren(...options(PMX)); $('clip').replaceChildren(new Option('原始站姿', ''), ...options(CLIP));
  if ($('motion').files[0]) $('clip').value = path($('motion').files[0]);
}
$('folder').onchange = $('motion').onchange = choices;
$('run').onclick = () => window.compareActor({ pmx: $('pmx').value, vmd: $('clip').value, time: $('time').valueAsNumber,
  lightYaw: $('light').value === '' ? undefined : Number($('light').value) }).catch(() => {});
