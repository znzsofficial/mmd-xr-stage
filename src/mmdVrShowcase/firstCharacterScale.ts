import type { Object3D, Skeleton, SkinnedMesh } from "three";
import { normalizeMmdVrModelScale } from "./mmdVrAdjustments";

const mean = (ys: number[]) => ys.reduce((sum, y) => sum + y, 0) / ys.length;
// Exact anatomical names only: 'HeadRibbon', 'footIK', etc. are not landmarks.
function landmark(name: string) {
  const n = name.normalize("NFKC").toLowerCase().split(":").pop()!.replace(/[\s_.-]/g, "");
  if (/^(?:[左右]?(?:目|眼)|(?:(?:left|right|l|r)?eye|eye(?:left|right|l|r)))$/.test(n)) return "eyes";
  if (/^(?:頭|头|head)$/.test(n)) return "head";
  if (/^(?:[左右]?(?:足首|脚踝)|(?:left|right|l|r)?(?:ankle|foot)|(?:ankle|foot)(?:left|right|l|r))$/.test(n)) return "feet";
}

/** Called on a fresh, unanimated unit-scale MMD root only. Whole-mesh bounds
 * often include hair, helper meshes or stage FX far outside the person's body. */
export function firstCharacterScale(root: Object3D | null): number | undefined {
  if (!root) return;
  root.updateWorldMatrix(true, true);
  const seen = new Set<Skeleton>();
  let scale: number | undefined;
  root.traverse(child => {
    const mesh = child as SkinnedMesh;
    if (scale != null || !mesh.isSkinnedMesh || !mesh.skeleton || seen.has(mesh.skeleton)) return;
    seen.add(mesh.skeleton);
    const samples = { eyes: [] as number[], head: [] as number[], feet: [] as number[] };
    for (const bone of mesh.skeleton.bones) {
      const jp = bone.userData.mmdBoneName;
      const part = (typeof jp === "string" && landmark(jp)) || landmark(bone.name);
      const y = bone.matrixWorld.elements[13];
      if (part && Number.isFinite(y)) samples[part].push(y);
    }
    const top = samples.eyes.length ? samples.eyes : samples.head;
    if (!top.length || !samples.feet.length) return;
    const height = mean(top) - mean(samples.feet);
    if (height > 3) scale = normalizeMmdVrModelScale(1.6 / height);
  });
  return scale;
}
