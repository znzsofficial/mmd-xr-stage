import * as T from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { ThreeMmdLoader, disposeMmdModel, syncMmdSpecularDirection } from '@yohawing/three-mmd-loader';
import { createLocalTextureResolver } from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import { applyMaterialOverrides } from '../../src/mmdVrShowcase/mmdRuntime/mmdRuntimeMaterials';
import { materialSlotKeys } from '../../src/mmdVrShowcase/mmdRuntime/materialSlotKey';
import { prepareMmdVrModel } from '../../src/mmdVrShowcase/stage/loading/prepareMmdVrModel';
import { firstCharacterScale } from '../../src/mmdVrShowcase/stage/loading/firstCharacterScale';
import { createActorMaterialAdapter } from './materialAdapter.js';
import { parseHybridSlots } from './hybridToon.js';
import { measureFringe } from './fringeStudy.js';

const SIZE = 600, AMBIENT = .55;
const originalYaw = T.MathUtils.radToDeg(Math.atan2(.18,1.7));
const $ = id => document.getElementById(id);
const path = f => f.webkitRelativePath || f.name;
const inputFiles = () => [...$('folder').files, ...$('motion').files];
const materials = mesh => [mesh.material].flat();
const hybridRoles = ['cloth', 'leather', 'metal'];
const gradeNames = { balanced: '舞台平衡色', hybrid: '写实卡渲', legacy: 'Loader 原色' };

function showSlotCatalog(source) {
  // Names belong only to the actor's local controls, never to comparison metrics.
  $('slotList').replaceChildren(...source.map((m, index) => {
    const info = m.userData.mmdMaterial;
    const labels = [...new Set([info?.name,info?.englishName].map(n => n?.trim()).filter(Boolean))];
    const row = document.createElement('li'); row.value = index;
    row.textContent = labels.join(' / ') || '未命名'; return row;
  }));
  $('catalogStatus').textContent = `共 ${source.length} 个原始材质槽。名称仅在本页显示。`;
}

function pick(files, selector, type) {
  const candidates = files.filter(f => type.test(f.name));
  if (selector == null && candidates.length === 1) return candidates[0];
  const matches = candidates.filter(f => f === selector || path(f) === selector || f.name === selector);
  if (matches.length !== 1) throw Error(`Select one ${type === PMX ? 'PMX' : 'VMD/VPD'} (use its directory-relative path for duplicate names).`);
  return matches[0];
}
const PMX = /\.pmx$/i, CLIP = /\.(vmd|vpd)$/i;

// Full-body framing uses bind geometry; close-ups follow the evaluated reference
// eyes. Both renderers share that reference camera, never a separate pixel fit.
function framing(model, scale, focus, yaw) {
  const box = new T.Box3().setFromBufferAttribute(model.mesh.geometry.getAttribute('position'));
  const height = box.max.y - box.min.y, center = box.getCenter(new T.Vector3()).multiplyScalar(scale);
  const originalRadius = Math.hypot(.18,1.7);
  let radius = originalRadius * height * scale;
  if (focus !== 'body') {
    const bones = model.mesh.skeleton.bones;
    const bone = names => bones.find(b => [b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n => n && names.includes(n.toLowerCase())));
    const eyes = [bone(['左目','left eye','eye_l']),bone(['右目','right eye','eye_r'])];
    if (eyes.every(Boolean)) center.copy(eyes[0].getWorldPosition(new T.Vector3())).lerp(eyes[1].getWorldPosition(new T.Vector3()), .5);
    else {
      const head = bone(['頭','head']);
      if (head) head.getWorldPosition(center).y += height * scale * .06;
      else center.y = (box.max.y - height * .135) * scale;
    }
    center.y -= height * scale * (focus === 'face' ? .012 : .14);
    radius = height * scale * (focus === 'face' ? .335 : .83);
  }
  const a = T.MathUtils.degToRad(yaw), eye = center.clone().addScaledVector(new T.Vector3(Math.sin(a), .06/originalRadius, Math.cos(a)),radius);
  return { scale, focus, yaw, eye: eye.toArray(), center: center.toArray() };
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

// Determine a material's visible contribution at the chosen pose by toggling its
// actual draws. Compare only foreground pixels both backends attribute to it.
function studySlots(indices, total, draws, full, redraw, common, gpu) {
  const stats = {};
  for (const slot of indices) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= total) throw Error('Invalid study slot');
    const members = [...draws].filter(([,s]) => s.slot === slot && s.visible);
    let off;
    try { for (const [m] of members) m.visible=false; off=redraw(); }
    finally { for (const [m] of members) m.visible=true; }
    const mask=new Uint8Array(full.length/4);
    for(let j=0;j<full.length;j+=4) if(full[j+3]>240 && Math.max(Math.abs(full[j]-off[j]),Math.abs(full[j+1]-off[j+1]),Math.abs(full[j+2]-off[j+2]),Math.abs(full[j+3]-off[j+3]))>8)mask[j/4]=1;
    if (!gpu) { (common.slots ??= new Map()).set(slot,{mask,full}); continue; }
    const ref=common.slots.get(slot), levels=[[],[]]; let sum=0,n=0;
    const luma=(p,j)=>.2126*p[j]+.7152*p[j+1]+.0722*p[j+2];
    for(let i=0;i<mask.length;i++) if(mask[i]&&ref.mask[i]) {
      const j=i*4; n++;
      levels[0].push(luma(ref.full,j)); levels[1].push(luma(full,j));
      for(let k=0;k<3;k++)sum+=Math.abs(full[j+k]-ref.full[j+k]);
    }
    stats[slot]={commonPixels:n,meanAbsoluteRgb:n?+(sum/(n*3)).toFixed(2):null, lumaP50P90:levels.map(values=>{
      values.sort((a,b)=>a-b);return n?[.5,.9].map(q=>+values[Math.floor((n-1)*q)].toFixed(2)):null;
    })};
    if (common.previous) {
      // Fixed WebGL contribution mask, even when the style changes GPU coverage.
      const previous = common.previous.pixels;
      let pixels = 0, changed = 0;
      for (let i=0;i<ref.mask.length;i++) if (ref.mask[i]) {
        const j=i*4; pixels++;
        if (full[j]!==previous[j] || full[j+1]!==previous[j+1] || full[j+2]!==previous[j+2] || full[j+3]!==previous[j+3]) changed++;
      }
      stats[slot].previousWebgpu = { pixels, changedPixels: pixels ? changed : null };
    }
  }
  return stats;
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
    if (gpu) adapter = await createActorMaterialAdapter(renderer, light, {balancedModelColor:input.balanced,ambientIntensity:AMBIENT,hybridSlots:input.hybridSlots}); // rejects WebGL fallback
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
    model = await input.loader.loadModel(input.pmx, adapter?.loadOptions);
    const source = materials(model.mesh), slotCount = source.length;
    if (!gpu) {
      if (input.pmx === selectedActor()) showSlotCatalog(source);
      for (const slots of Object.values(input.hybridSlots ?? {})) {
        for (const slot of slots) if (slot >= slotCount) throw Error(`槽 ${slot} 不在当前演员的材质表内（0–${slotCount-1}）。`);
      }
    }
    if (input.hideSlot != null && (!Number.isInteger(input.hideSlot) || input.hideSlot < 0 || input.hideSlot >= slotCount)) throw Error('hideSlot must be an authored PMX slot index');
    const slots = model.diagnostics.materials.map(({ materialIndex: i, pmxTransparencyMode, textureTransparencyMode, finalTransparencyMode }) => ({
      index: i, textured: !!source[i].map, edge: !!source[i].userData.mmdMaterial?.flags?.edge,
      pmxAlpha: pmxTransparencyMode, textureAlpha: textureTransparencyMode ?? null, resolvedAlpha: finalTransparencyMode,
    }));
    const scale = common.scale ??= input.scale ?? firstCharacterScale(model.root) ?? 1;
    scene.add(model.root); model.root.scale.setScalar(scale); model.root.updateMatrixWorld(true);
    const bind = poseVector(model.mesh);
    if (adapter) await adapter.attach(model);
    if (input.clip) model.setAnimation(input.clip);
    const evaluated = model.update(input.time, { physics: false, ik: !!input.clip });
    model.root.updateMatrixWorld(true);
    const pose = poseVector(model.mesh), poseDeltaFromBind = maxDelta(pose, bind);
    const poseDeltaFromGL = maxDelta(pose, common.pose ??= pose);
    if (poseDeltaFromGL > 1e-5) throw Error(`CPU bone/morph poses differ by ${poseDeltaFromGL}`);
    const frame = common.frame ??= framing(model, scale, input.focus, input.yaw);
    const camera = new T.PerspectiveCamera(35, 1, .005 * scale, 1500 * scale);
    camera.position.fromArray(frame.eye); camera.lookAt(...frame.center); camera.updateMatrixWorld();
    if (adapter) await adapter.prepare(scene); else prepareWebGL(model, light);
    const evaluatedMaterials = materials(model.mesh);
    for (const slot of slots) {
      const m = evaluatedMaterials[slot.index];
      Object.assign(slot, { opacity: m.opacity, transparent: m.transparent, alphaTest: m.alphaTest, depthWrite: m.depthWrite });
    }

    // Map actual draws (including split-body/proxy draws) to original slots.
    // TSL appends edge materials to the list; they are not additional PMX slots.
    const edges = new Set(), draws = new Map();
    model.root.traverse(o => {
      if (!o.isMesh) return;
      for (const m of materials(o)) {
        const edge = m.userData.mmdTslOutlineMaterial ?? m.userData.mmdOutlineMaterial;
        if (edge) edges.add(m);
        const slot = edge?.sourceMaterialIndex ?? m.userData.mmdMaterial?.materialIndex ?? o.userData.mmdMaterialRenderProxy?.materialIndex;
        if (input.hideSlot != null && slot === input.hideSlot) m.visible = false;
        // Geometry control only: r187 WebGL normally draws transparent,
        // double-sided materials back then front; this TSL path draws once.
        if (!gpu && input.singlePassHair && !edge && m.transparent && m.side===T.DoubleSide && input.fringeStudy?.hairSlots.includes(slot)) m.forceSinglePass=true;
        draws.set(m, {slot, edge:!!edge, visible:m.visible});
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
    const regionStats = input.studySlots?.length ? studySlots(input.studySlots,slotCount,draws,shot.pixels,()=>snapshot(renderer,scene,camera).pixels,common,gpu) : undefined;
    let fringe;
    if (input.fringeStudy) {
      const {stats, mask, hairAlpha} = measureFringe(draws,input.fringeStudy,slotCount,()=>snapshot(renderer,scene,camera).pixels,shot.pixels);
      fringe = stats;
      if (!gpu) common.fringe = {mask, hairAlpha, pixels:shot.pixels};
      else {
        let n = 0, sum = 0, union = 0, alphaDelta = 0, unionRgb = 0, largeRgb = 0;
        for (let i=0; i<mask.length; i++) {
          if (mask[i] || common.fringe.mask[i]) {
            union++; alphaDelta+=Math.abs(hairAlpha[i]-common.fringe.hairAlpha[i]);let max=0;
            for(let k=0;k<3;k++){const delta=Math.abs(shot.pixels[4*i+k]-common.fringe.pixels[4*i+k]);unionRgb+=delta;max=Math.max(max,delta);}
            if(max>16)largeRgb++;
          }
          if (mask[i] && common.fringe.mask[i]) { n++; for(let k=0;k<3;k++)sum+=Math.abs(shot.pixels[4*i+k]-common.fringe.pixels[4*i+k]); }
        }
        Object.assign(fringe,{commonOverlap:n,overlapIoU:union?+(n/union).toFixed(4):null,commonRgbMAE:n?+(sum/(n*3)).toFixed(2):null,
          unionOverlap:union,unionRgbMAE:union?+(unionRgb/(union*3)).toFixed(2):null,unionLargeRgb:largeRgb,isolatedAlphaMAE:union?+(alphaDelta/union).toFixed(2):null});
      }
    }
    // Same evaluated pose, camera and material state; turn off only authored edge draws.
    const activeEdges = [...edges].filter(m => m.visible);
    for (const m of activeEdges) m.visible = false;
    const outlineChangedPixels = activeEdges.length ? changedPixels(shot.pixels, snapshot(renderer, scene, camera).pixels) : 0;
    if (gpu) {
      await renderer.backend.device.queue.onSubmittedWorkDone();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (gpuError) throw gpuError;
      common.gpuPixels = shot.pixels;
    }
    else {
      const gl = renderer.getContext();
      for (const p of renderer.info.programs) if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) throw Error('WebGL program failed to link');
    }
    return { image: shot.copy.toDataURL('image/png'), metrics: { ...frame, time: input.time, glSinglePassHairControl:!gpu && input.singlePassHair, lightPosition: light.position.toArray(), evaluatedFrame: evaluated.frame, poseDeltaFromBind, poseDeltaFromGL,
      visiblePixels, partialAlphaPixels, outlineDrawMaterials: activeEdges.length, outlineChangedPixels, drawCalls, slots, fringe, regionStats,
      grade: gpu ? input.grade : 'balanced', hybridSlots: gpu ? input.hybridSlots : undefined, previousWebgpuGrade: gpu ? common.previous?.grade : undefined,
      textureWarnings: model.diagnostics.textures.map(({ code, materialIndex }) => ({ code, materialIndex })),
    } };
  } finally {
    if (model) { adapter?.detach(model); disposeMmdModel(model, { textures: 'owned' }); }
    adapter?.dispose(); await renderer.dispose(); renderer.forceContextLoss?.();
  }
}

// Selectors accept a File in files, an exact relative path or a unique basename.
// Omit vmd for bind pose; pass a .vpd via pose instead. hideSlot is zero-based.
let busy = false, lastShot;
window.compareActor = async ({ files = inputFiles(), pmx, vmd, pose, time = 0, scale, hideSlot, lightYaw, focus = 'body', yaw = originalYaw, balanced = true, hybridSlots, fringeStudy, studySlots, singlePassHair = false } = {}) => {
  if (busy) throw Error('A comparison is running');
  if (!Number.isFinite(time) || time < 0 || (scale != null && (!Number.isFinite(scale) || scale < .01 || scale > 10))) throw Error('Invalid time or placement scale');
  if (lightYaw != null && !Number.isFinite(lightYaw)) throw Error('Invalid light angle');
  if (!['body','face','bust'].includes(focus) || !Number.isFinite(yaw)) throw Error('Invalid camera framing');
  busy = true; $('controls').disabled = true; $('summary').textContent = ''; $('slotChanges').textContent = '';
  $('previous').hidden = true; $('previousImage').removeAttribute('src'); $('gpuCaption').textContent = 'WebGPU';
  for (const id of ['webgl', 'webgpu']) $(id).removeAttribute('src');
  try {
    const selection = parseHybridSlots(hybridSlots), emptyHybrid = hybridSlots != null && !selection.size;
    // Snapshot caller-owned arrays before either backend starts loading files.
    hybridSlots = selection.size ? Object.fromEntries(hybridRoles.map(k => [k, [...(hybridSlots[k] ?? [])]])) : undefined;
    const grade = hybridSlots ? 'hybrid' : balanced ? 'balanced' : 'legacy';
    const all = Array.from(files), file = pick(all, pmx, PMX);
    const loader = new ThreeMmdLoader({ textureResolver: createLocalTextureResolver(file, all), geometryAwareAlpha: true, runtime: { physics: 'none' } });
    const selected = pose ?? vmd, motion = selected ? pick(all, selected, CLIP) : null;
    const clip = !motion ? null : /\.vpd$/i.test(motion.name) ? await loader.loadPoseAnimation(motion) : await loader.loadAnimation(motion);
    const input = { pmx: file, loader, clip, time, scale, hideSlot, lightYaw, focus, yaw, balanced, grade, hybridSlots, fringeStudy, studySlots, singlePassHair }, common = {}, result = {};
    const viewKey = JSON.stringify([time,scale,hideSlot,lightYaw,focus,yaw,singlePassHair]);
    for (const id of ['webgl', 'webgpu']) {
      $('status').textContent = `渲染 ${id}…`;
      result[id] = await draw(id === 'webgpu', input, common); $(id).src = result[id].image;
      if (id === 'webgl' && lastShot?.file === file && lastShot.motion === motion && lastShot.viewKey === viewKey && lastShot.reference === result.webgl.image &&
        lastShot.files.length === all.length && all.every((f,i) => f === lastShot.files[i])) common.previous = lastShot;
      $('summary').textContent += `${id}: ${JSON.stringify(result[id].metrics, (k, v) => k === 'slots' ? v.length : v)}\n`;
    }
    $('gpuCaption').textContent = `WebGPU · ${gradeNames[grade]}`;
    if (common.previous) {
      $('previousImage').src = common.previous.image; $('previousCaption').textContent = `上一次 WebGPU · ${gradeNames[common.previous.grade]}`; $('previous').hidden = false;
      const changes = Object.entries(result.webgpu.metrics.regionStats ?? {}).map(([slot,{previousWebgpu:s}]) =>
        s.pixels ? `槽 ${slot}：${s.changedPixels} / ${s.pixels} 像素改变` : `槽 ${slot}：无可测像素`);
      if (changes.length) $('slotChanges').textContent = `与上一次 WebGPU 对照（按 WebGL 可见区域）：${changes.join('；')}。`;
    }
    // Keep only captures from one run, never renderers, materials or live models.
    lastShot = { file, motion, viewKey, files:all, reference:result.webgl.image, pixels:common.gpuPixels, image:result.webgpu.image, grade };
    $('status').textContent = emptyHybrid ? `尚未分配材质槽，本次显示${gradeNames[grade]}。` : '对照完成'; return result;
  } catch (err) { $('status').textContent = String(err); throw err; }
  finally { busy = false; $('controls').disabled = false; }
};

const selectedActor = () => [...$('folder').files].find(f => PMX.test(f.name) && path(f) === $('pmx').value);
function resetActorSlots() {
  lastShot = undefined; $('previous').hidden = true; $('gpuCaption').textContent = 'WebGPU';
  for (const id of ['webgl','webgpu','previousImage']) $(id).removeAttribute('src');
  for (const id of ['summary','status','slotChanges']) $(id).textContent = '';
  $('slotList').replaceChildren(); $('catalogStatus').textContent = '首次渲染对照后，这里会列出当前演员的材质。';
  for (const id of ['regions','hairSlots','eyeSlots',...hybridRoles.map(key => `${key}Slots`)]) $(id).value = '';
}
function choices() {
  const oldActor = $('pmx').value;
  const files = inputFiles(), options = type => files.filter(f => type.test(f.name)).map(f => new Option(path(f), path(f)));
  $('pmx').replaceChildren(...options(PMX)); $('clip').replaceChildren(new Option('原始站姿', ''), ...options(CLIP));
  if ([...$('pmx').options].some(o => o.value === oldActor)) $('pmx').value = oldActor;
  if ($('motion').files[0]) $('clip').value = path($('motion').files[0]);
}
$('folder').onchange = () => { choices(); resetActorSlots(); };
$('pmx').onchange = resetActorSlots; $('motion').onchange = choices;
$('grade').onchange = () => {
  const hybrid = $('grade').value === 'hybrid'; $('hybridControls').hidden = !hybrid;
  if (hybrid) $('catalog').open = true;
};
const slotList = id => $(id).value.trim().split(/[,，\s]+/).filter(Boolean).map(s => /^\d+$/.test(s) ? Number(s) : NaN);
$('run').onclick = () => window.compareActor({ pmx: $('pmx').value, vmd: $('clip').value, time: $('time').valueAsNumber,
  lightYaw: $('light').value === '' ? undefined : Number($('light').value), focus:$('focus').value, yaw:$('yaw').value===''?originalYaw:Number($('yaw').value), balanced:$('grade').value!=='legacy',
  hybridSlots:$('grade').value==='hybrid'?Object.fromEntries(hybridRoles.map(key => [key, slotList(`${key}Slots`)])):undefined,
  studySlots:slotList('regions'), singlePassHair:$('singleHair').checked,
  fringeStudy:$('hairSlots').value.trim()||$('eyeSlots').value.trim()?{hairSlots:slotList('hairSlots'),eyeSlots:slotList('eyeSlots')}:undefined }).catch(err => { $('status').textContent = String(err); });
