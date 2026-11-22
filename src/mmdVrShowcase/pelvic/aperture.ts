import type { Object3D, SkinnedMesh } from 'three';
import { wandMorphNames } from '../play/wandResponse';
import { getApertureMorph } from './apertureConfig';

type Surface = { root: Object3D; mesh: SkinnedMesh; renderOrderMeshes: readonly SkinnedMesh[] };
type Channel = { weights: number[]; index: number; before: number };

function bind(mesh: SkinnedMesh, name: string): Channel[] {
  // Recheck the mounted model. A previously configured asset can be reloaded
  // without the same vertex channel; bone/group/material morphs are not slots.
  if (!wandMorphNames(mesh).includes(name)) return [];
  const index = mesh.morphTargetDictionary![name], source = mesh.morphTargetInfluences;
  if (!source || !Number.isFinite(source[index])) return [];
  const channels = [{ weights: source, index, before: 0 }];
  // Loader material/outline proxies alias the source or compact body array.
  // There is no per-proxy weight to set. Split material bodies, however, have
  // a local channel order; some have no vertices in the chosen morph at all.
  const bodies: readonly SkinnedMesh[] = mesh.userData.mmdMorphSplitBodyMeshes ?? [];
  for (const body of bodies) {
    const local = body.userData.mmdMorphSplitBody?.morphTargetIndices?.indexOf(index) ?? -1;
    const weights = body.morphTargetInfluences;
    if (local >= 0 && body.geometry.morphAttributes.position?.[local] && weights && Number.isFinite(weights[local]) &&
        !channels.some(c => c.weights === weights && c.index === local)) {
      channels.push({ weights, index: local, before: 0 });
    }
  }
  return channels;
}

/** Apply after pose and day-shape evaluation using the current rig result.
 * Restore in reverse display-layer order before evaluating again or leaving. */
export function createApertureLayer() {
  const bindings = new WeakMap<SkinnedMesh, { name: string; channels: Channel[] }>();
  let applied: Channel[] | null = null;
  function restore() {
    if (!applied) return;
    for (const c of applied) c.weights[c.index] = c.before;
    applied = null;
  }
  function apply(assetId: string, modelSurface: Surface | null, amount: number) {
    restore();
    if (!modelSurface?.root.visible || !Number.isFinite(amount) || amount <= 0) return;
    const name = getApertureMorph(assetId);
    if (name === null) return;
    const { mesh } = modelSurface;
    let binding = bindings.get(mesh);
    if (binding?.name !== name) {
      binding = { name, channels: bind(mesh, name) };
      bindings.set(mesh, binding);
    }
    const channels = binding.channels;
    if (!channels.length) return;
    const base = channels[0].weights[channels[0].index];
    if (!Number.isFinite(base)) return;
    const target = base + Math.max(0, 1 - base) * Math.min(1, amount);
    // Exactly the value the loader will copy source→body in onBeforeRender.
    // Keep each slot's OWN previous value for an exact paused-frame unwind.
    for (const c of channels) { c.before = c.weights[c.index]; c.weights[c.index] = target; }
    applied = channels;
  }
  return { restore, apply };
}
