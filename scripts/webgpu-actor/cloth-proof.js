// Developer fixture on probe.html?cloth-proof. The oracle is drawn by the
// untouched loader pipeline BEFORE installing the cloth material hook.
import * as T from 'three/webgpu';
import { ThreeMmdLoader, disposeMmdModel } from '@yohawing/three-mmd-loader';
import { createLocalTextureResolver } from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import { fitRig } from '../../experiments/gpu-cloth/rig.js';
import { makeSwatch } from '../../experiments/gpu-cloth/swatch.js';
import { createActorMaterialAdapter } from './materialAdapter.js';
import { createClothSurface } from './clothSurface.js';

const SIZE = 640, V = (x, y, z) => new T.Vector3(x, y, z);
const mounts = [
  { scale: .1, euler: [0, 0, 0], translation: [0, 0, 0], zoom: 1 },
  { scale: .167, euler: [.12, .73, -.09], translation: [1.2, .42, -1.8], zoom: .90 },
];
const filePath = f => f.webkitRelativePath || f.name;
const check = (condition, msg) => { if (!condition) throw Error(msg); };
const passKeys = ['full', 'withoutEdge', 'cloth', 'edge', 'body'];

// Original PMX slots/weights, not the surface adapter's vertex-to-node lookup.
// Draws with ANY positive weight belong to the selected patch's potential
// support. All remaining slots form an independently visible negative control.
function affectedSlots(mesh, rig) {
  const g = mesh.geometry, indices = g.getAttribute('skinIndex'), weights = g.getAttribute('skinWeight');
  const byBone = new Map(rig.nodes.map((n, i) => [n.bone, i]));
  const slots = rig.nodes.map(() => new Set());
  for (const { start, count, materialIndex } of g.groups) {
    for (let j = start; j < start + count; j++) {
      const v = g.index ? g.index.getX(j) : j;
      for (let k = 0; k < 4; k++) {
        const n = byBone.get(indices.getComponent(v, k));
        if (n != null && weights.getComponent(v, k) > 0) slots[n].add(materialIndex);
      }
    }
  }
  return slots;
}

function frame(mesh, bounds, mount, yaw) {
  const size = bounds.getSize(V()), center = bounds.getCenter(V());
  const span = Math.max(size.x, size.z, size.y, .1) * 1.65 * mount.scale / mount.zoom;
  center.y += size.y * .20;
  mesh.localToWorld(center);
  const orientation = mesh.getWorldQuaternion(new T.Quaternion());
  const direction = V(Math.sin(yaw), .11, Math.cos(yaw)).normalize().applyQuaternion(orientation);
  const camera = new T.OrthographicCamera(-span/2, span/2, span/2, -span/2, span * .01, span * 18);
  camera.position.copy(center).addScaledVector(direction, span * 6);
  camera.up.set(0, 1, 0).applyQuaternion(orientation); camera.lookAt(center); camera.updateMatrixWorld();
  return camera;
}

// A pure translation leaves normals, UVs, sparse morphs and material state
// alone. Counter-translate EACH immediate bone child back to its original
// world location: even a heavily weighted descendant must not follow the test
// node. The ordinary skeleton palette is the only input changed for the oracle.
function shiftBone(mesh, bone, deltaLocal) {
  const original = bone.position.clone();
  const children = bone.children.filter(c => c.isBone).map(c => [c, c.position.clone(), c.getWorldPosition(V())]);
  const worldDelta = deltaLocal.clone().applyMatrix3(new T.Matrix3().setFromMatrix4(mesh.matrixWorld));
  bone.position.copy(bone.parent.worldToLocal(bone.getWorldPosition(V()).add(worldDelta)));
  bone.updateMatrix(); bone.updateMatrixWorld(true);
  for (const [child, , world] of children) {
    child.position.copy(bone.worldToLocal(world)); child.updateMatrix();
  }
  bone.updateMatrixWorld(true); mesh.skeleton.update();
  return () => {
    bone.position.copy(original); bone.updateMatrix();
    for (const [child, local] of children) { child.position.copy(local); child.updateMatrix(); }
    bone.updateMatrixWorld(true); mesh.skeleton.update();
  };
}

function capture(renderer, ctx, scene, camera, adapter, mesh, slots) {
  adapter.prepare(scene); // synchronize once; this can re-enable edge materials
  const draws = mesh.material.map((m, i) => {
    const edge = m.userData.mmdTslOutlineMaterial;
    return { m, visible: m.visible, edge: !!edge, selected: slots.has(edge?.sourceMaterialIndex ?? i) };
  });
  const shot = {};
  try {
    for (const key of passKeys) {
      for (const d of draws) {
        const show = key === 'full' || (key === 'withoutEdge' && !(d.selected && d.edge)) ||
          (key === 'cloth' && d.selected && !d.edge) || (key === 'edge' && d.selected && d.edge) ||
          (key === 'body' && !d.selected);
        d.m.visible = d.visible && show;
      }
      renderer.render(scene, camera);
      // Copy final color-converted pixels in the same task as submission. 'copy'
      // also replaces transparent pixels left over from the preceding pass.
      ctx.drawImage(renderer.domElement, 0, 0);
      shot[key] = ctx.getImageData(0, 0, SIZE, SIZE).data;
    }
  } finally { for (const d of draws) d.m.visible = d.visible; }
  return shot;
}

const diff = (a, b, j) => Math.max(Math.abs(a[j]-b[j]), Math.abs(a[j+1]-b[j+1]), Math.abs(a[j+2]-b[j+2]), Math.abs(a[j+3]-b[j+3]));
function samePixels(a, b) {
  const changes = {};
  for (const key of passKeys) {
    let changed = 0;
    for (let j = 0; j < a[key].length; j += 4) if (diff(a[key], b[key], j)) changed++;
    changes[key] = changed;
  }
  return changes;
}

// Signal counts come ONLY from the reference renderer. In particular a dark
// outline revealed by a moving fill can change the composite even when its
// actual draw is frozen. Require motion in the isolated native outline draw,
// plus disappearance/appearance of its visible contribution with the actor ON.
function signals(base, oracle) {
  const n = { body: 0, bodyChanged: 0, visibleCloth: 0, outlineDraw: 0, oldEdge: 0, newEdge: 0 };
  for (let j = 0; j < base.full.length; j += 4) {
    if (base.body[j+3] > 100) n.body++;
    if (diff(base.body, oracle.body, j)) n.bodyChanged++;
    if (diff(base.cloth, oracle.cloth, j) > 12 && diff(base.withoutEdge, oracle.withoutEdge, j) > 12) n.visibleCloth++;
    if (diff(base.edge, oracle.edge, j) > 12) n.outlineDraw++;
    const before = diff(base.full, base.withoutEdge, j) > 12, after = diff(oracle.full, oracle.withoutEdge, j) > 12;
    if (before && !after) n.oldEdge++;
    if (!before && after) n.newEdge++;
  }
  return n;
}

const usable = s => s.body >= 256 && s.bodyChanged === 0 && s.visibleCloth >= 48 && s.outlineDraw >= 16 && s.oldEdge >= 6 && s.newEdge >= 6;

function agreement(base, oracle, actual) {
  const passes = {};
  for (const key of passKeys) {
    let motion = 0, wrong = 0, wrongOutsideMotion = 0;
    for (let j = 0; j < base[key].length; j += 4) {
      const moved = diff(base[key], oracle[key], j) > 8;
      motion += Number(moved);
      if (diff(actual[key], oracle[key], j) > 4) { wrong++; if (!moved) wrongOutsideMotion++; }
    }
    // Bound bad pixels against the *moving footprint*, not the image area.
    passes[key] = { motion, wrong, wrongOutsideMotion, limit: key === 'body' ? 0 : Math.floor(motion * .025) };
  }
  const edges = { lost: 0, correctlyLost: 0, gained: 0, correctlyGained: 0, spurious: 0 };
  for (let j = 0; j < base.full.length; j += 4) {
    const old = diff(base.full, base.withoutEdge, j) > 12, next = diff(oracle.full, oracle.withoutEdge, j) > 12;
    const shown = diff(actual.full, actual.withoutEdge, j) > 12;
    if (old && !next) { edges.lost++; if (!shown) edges.correctlyLost++; }
    if (!old && next) { edges.gained++; if (shown) edges.correctlyGained++; }
    if (!old && !next && shown) edges.spurious++;
  }
  return { passes, edges, ok: Object.values(passes).every(p => p.wrong <= p.limit) &&
    edges.correctlyLost >= edges.lost * .95 && edges.correctlyGained >= edges.gained * .95 &&
    edges.spurious <= Math.floor((edges.lost + edges.gained) * .025) };
}

function poseSignature(mesh) {
  return [...mesh.skeleton.bones.flatMap(b => b.matrix.elements), ...(mesh.morphTargetInfluences ?? [])];
}

export async function runClothProof({ files = [], pmx, clip, time = 0, onPair } = {}) {
  const generated = !pmx;
  check(!generated || files.length === 0, 'Select a PMX from the local folder');
  check(Number.isFinite(time) && time >= 0, 'Invalid pose time');
  if (generated) { pmx = makeSwatch(); files = [pmx]; }
  const renderer = new T.WebGPURenderer({ alpha: true, antialias: false });
  const scene = new T.Scene(), light = new T.DirectionalLight(0xfff4e8, 1.1);
  light.position.set(-3, 4, 5); scene.add(light, new T.AmbientLight(0xffffff, .55));
  let adapter, model, surface, gpuError, device, errorScope = false;
  renderer.onError = e => { gpuError ??= Error(`${e.type}: ${e.message}`); };
  renderer.onDeviceLost = e => { gpuError ??= Error(`WebGPU device lost: ${e.message}`); };
  try {
    adapter = await createActorMaterialAdapter(renderer, light, { balancedModelColor: true });
    device = renderer.backend.device;
    const info = device.adapterInfo;
    check(info?.vendor && !info.isFallbackAdapter && !/swiftshader|llvmpipe|warp|software/i.test([info.vendor, info.architecture, info.description].join(' ')), 'Cannot verify a native hardware WebGPU device');
    device.pushErrorScope('validation'); errorScope = true;
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
    const copy = document.createElement('canvas'); copy.width = copy.height = SIZE;
    const ctx = copy.getContext('2d', { willReadFrequently: true }); ctx.globalCompositeOperation = 'copy';
    const loader = new ThreeMmdLoader({ textureResolver: createLocalTextureResolver(pmx, files), geometryAwareAlpha: true, runtime: { physics: 'none' } });
    model = await loader.loadModel(pmx, adapter.loadOptions); scene.add(model.root);
    const mesh = model.mesh, rig = fitRig(mesh), slots = affectedSlots(mesh, rig);
    const source = [...mesh.material], textureMaps = source.map(m => m.map);
    const unresolved = source.flatMap((m, i) => m.userData.mmdMaterial?.texturePath && !m.map?.image ? [i] : []);
    check(!unresolved.length, `Missing authored diffuse textures at slots ${unresolved.join(', ')}; select the complete actor folder`);
    if (generated) {
      // The stock swatch has no edge flags. Author one black 2px hem on this
      // in-memory model only; use the loader's real inverted-hull material.
      const hem = source[2].userData.mmdMaterial;
      hem.flags = { ...hem.flags, edge: true }; hem.edgeSize = 2;
    }
    await adapter.attach(model);
    if (clip) model.setAnimation(/\.vpd$/i.test(clip.name) ? await loader.loadPoseAnimation(clip) : await loader.loadAnimation(clip));
    model.update(time, { physics: false, ik: !!clip }); // no further animation evaluation
    if (generated) mesh.material[2].userData.mmdMaterialState.edgeSize = 2;
    model.root.updateMatrixWorld(true); adapter.prepare(scene);
    check(textureMaps.every((map, i) => !map || mesh.material[i].userData.mmdTslSourceDiffuseTexture === map), 'A source diffuse map was lost at TSL attach');
    const edgeSlots = new Set(mesh.material.filter(m => m.visible && m.userData.mmdTslOutlineMaterial).map(m => m.userData.mmdTslOutlineMaterial.sourceMaterialIndex));
    const local = rig.nodes.map(n => mesh.worldToLocal(mesh.skeleton.bones[n.bone].getWorldPosition(V())));
    const bounds = new T.Box3().setFromPoints(local), extent = bounds.getSize(V());
    const width = Math.max(extent.x, extent.z); check(width > 0, 'No measurable skirt span');
    const delta = V(.22, -.105, .036).multiplyScalar(width * rig.scale);
    const deltaLocal = delta.clone().divideScalar(rig.scale);
    const candidates = rig.nodes.map((_, i) => i).filter(i => !rig.nodes[i].pin && [...slots[i]].some(s => edgeSlots.has(s)))
      .sort((a, b) => (local[b].x-.40*local[b].y) - (local[a].x-.40*local[a].y));
    check(candidates.length, 'No active skirt node influences a visible authored outline group');
    const place = m => {
      model.root.scale.setScalar(m.scale); model.root.rotation.set(...m.euler); model.root.position.fromArray(m.translation);
      model.root.updateMatrixWorld(true); mesh.skeleton.update();
    };
    const shot = (camera, node) => capture(renderer, ctx, scene, camera, adapter, mesh, slots[node]);
    const reference = (mount, node, yaw) => {
      place(mount); const camera = frame(mesh, bounds, mount, yaw), base = shot(camera, node);
      const restore = shiftBone(mesh, mesh.skeleton.bones[rig.nodes[node].bone], deltaLocal);
      let oracle; try { oracle = shot(camera, node); } finally { restore(); }
      return { camera, base, oracle, signal: signals(base, oracle) };
    };
    // Pick an observable projection using only native reference images. Once
    // chosen, the node, displacement, pose and cameras are locked for the DUT.
    let refs, node, yaw; const attempts = [];
    outer: for (const i of candidates.slice(0, 6)) for (const angle of [0, .31, -.31]) {
      const first = reference(mounts[0], i, angle);
      attempts.push({ node: i, yaw: angle, ...first.signal });
      if (!usable(first.signal)) continue;
      const placed = reference(mounts[1], i, angle);
      if (!usable(placed.signal)) { attempts.push({ node: i, yaw: angle, mount: 1, ...placed.signal }); continue; }
      refs = [first, placed]; node = i; yaw = angle; break outer;
    }
    check(refs, `Insufficient native control signal (no cloth result measured): ${JSON.stringify(attempts)}`);
    const poseBefore = poseSignature(mesh), checkPose = () => {
      const p = poseSignature(mesh);
      check(p.length === poseBefore.length && p.every((v, i) => v === poseBefore[i]), 'GPU displacement changed the evaluated CPU pose');
    };
    place(mounts[0]); surface = await createClothSurface(renderer, mesh, rig);
    const report = { model: generated ? 'generated swatch; fixture-authored hem edge' : 'picked local PMX',
      device: { vendor: info.vendor, architecture: info.architecture }, three: T.REVISION,
      pose: clip ? (/\.vpd$/i.test(clip.name) ? 'VPD' : 'VMD') : 'standing', time,
      textures: textureMaps.filter(Boolean).length, textureWarnings: model.diagnostics.textures.map(t => ({ code: t.code, slot: t.materialIndex })),
      node, bone: rig.nodes[node].bone, slots: [...slots[node]], targetTexturedSlots: [...slots[node]].filter(s => textureMaps[s]),
      rigScale: rig.scale, deltaRigMeters: delta.toArray(), deltaMeshLocal: deltaLocal.toArray(), yaw, oracleAttempts: attempts.length, mounts: [] };
    for (const [index, ref] of refs.entries()) {
      const mount = mounts[index]; place(mount);
      const zero = shot(ref.camera, node);
      await surface.displace(node, delta); const moved = shot(ref.camera, node); checkPose();
      await surface.reset(); const reset = shot(ref.camera, node); checkPose();
      const row = { mount, signal: ref.signal, initialVsUnmodified: samePixels(zero, ref.base),
        movedVsOracle: agreement(ref.base, ref.oracle, moved), resetVsInitial: samePixels(zero, reset),
        untouchedBodyChanged: sameBody(zero.body, moved.body) };
      report.mounts.push(row); onPair?.(index, ref.base.full, ref.oracle.full, moved.full);
      check(Object.values(row.initialVsUnmodified).every(n => n === 0) && Object.values(row.resetVsInitial).every(n => n === 0) &&
        row.untouchedBodyChanged === 0 && row.movedVsOracle.ok, `Cloth pixel mismatch: ${JSON.stringify(report)}`);
    }
    await device.queue.onSubmittedWorkDone(); const validation = await device.popErrorScope(); errorScope = false;
    if (validation || gpuError) throw gpuError || Error(validation.message);
    return report;
  } finally {
    if (errorScope) { const e = await device.popErrorScope(); if (e) console.error('Cloth proof GPU validation:', e.message); }
    surface?.dispose(); if (model) { adapter?.detach(model); disposeMmdModel(model, { textures: 'owned' }); }
    adapter?.dispose(); await renderer.dispose();
  }
}

function sameBody(a, b) {
  let changed = 0; for (let j = 0; j < a.length; j += 4) if (diff(a, b, j)) changed++;
  return changed;
}

export function installClothProof() {
  const $ = id => document.getElementById(id), controls = $('controls');
  const button = document.createElement('button'); button.type = 'button'; button.id = 'clothProof';
  button.textContent = '验证单个裙节点（未选模型时用样布）'; controls.append(button);
  const evidence = document.createElement('section'); controls.after(evidence);
  window.runClothProof = async () => {
    check(!controls.disabled, 'A comparison is running'); controls.disabled = true; evidence.replaceChildren();
    $('status').textContent = '正在比对原生衣面、描边和未选身体…'; $('summary').textContent = '';
    const files = [...$('folder').files, ...$('motion').files];
    try {
      const report = await runClothProof({ files, pmx: files.find(f => filePath(f) === $('pmx').value),
        clip: files.find(f => filePath(f) === $('clip').value), time: $('time').valueAsNumber,
        onPair(index, ...shots) {
          shots.forEach((p, i) => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
            canvas.getContext('2d').putImageData(new ImageData(p, SIZE, SIZE), 0, 0); canvas.style.width = '100%';
            const figure = document.createElement('figure'), caption = document.createElement('figcaption');
            caption.textContent = `${index ? '换挂载' : '原挂载'} · ${['原姿', '骨平移参考', '单节点 GPU'][i]}`;
            figure.append(caption, canvas); evidence.append(figure);
          });
        } });
      $('status').textContent = '两种挂载逐像素对照通过'; $('summary').textContent = JSON.stringify(report, null, 2); return report;
    } catch (e) { $('status').textContent = String(e); throw e; }
    finally { controls.disabled = false; }
  };
  button.onclick = () => window.runClothProof().catch(() => {});
}
