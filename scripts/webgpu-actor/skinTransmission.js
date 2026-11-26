import { BufferAttribute, MathUtils, Vector3 } from 'three';
import { attribute, normalView, positionViewDirection, vec3 } from 'three/tsl';

const maskName = 'mmdSkinThinness';

function digit(bone) {
  for (const name of [bone.userData.mmdBoneName, bone.name, bone.userData.mmdEnglishBoneName]) {
    const n = name?.normalize('NFKC').toLowerCase().replace(/[\s_.:-]/g, '');
    const jp = n?.match(/^[左右]?(親指|拇指|人指|人差指|食指|中指|薬指|小指)(?:\d+|先)$/);
    const en = n?.match(/^(?:mixamorig)?(?:left|right|l|r)?(?:hand)?(thumb|index|middle|ring|little|pinky)(?:finger)?(?:\d+|tip)(?:left|right|l|r)?$/);
    if (jp || en) return (jp ?? en)[1];
  }
}

function fingerSegments(mesh) {
  const { bones, boneInverses } = mesh.skeleton;
  const names = bones.map(digit), local = mesh.bindMatrix.clone().invert();
  const heads = bones.map((_, i) => names[i] && new Vector3()
    .setFromMatrixPosition(boneInverses[i].clone().invert()).applyMatrix4(local));
  const ids = new Map(bones.map((b, i) => [b, i])), lengths = [];
  const segments = bones.map((bone, i) => {
    if (!heads[i]) return;
    const child = bone.children.find(b => names[ids.get(b)] === names[i]);
    const parent = ids.get(bone.parent), a = heads[i];
    // A terminal phalanx often has no tip bone. Continue the preceding axis
    // for at most its length; only vertices weighted to this bone may use it.
    const axis = child ? heads[ids.get(child)].clone().sub(a)
      : names[parent] === names[i] ? a.clone().sub(heads[parent]) : null;
    const length = axis?.length();
    if (!(length > 0)) return;
    if (child) lengths.push(length);
    return { a, axis: axis.divideScalar(length), length };
  });
  lengths.sort((a, b) => a - b);
  return { segments, scale: lengths[Math.floor(lengths.length / 2)] };
}

// Before TSL morph storage replaces position. Returns the number of nonzero
// vertices. Missing weights/chains yield a zero attribute, never a tint over
// the entire slot. Ear/fur/jewellery cannot be distinguished by a head weight.
export function prepareSkinTransmission(mesh, skinSlots) {
  const geo = mesh.geometry, { position, skinWeight, skinIndex } = geo.attributes;
  const slots = new Set(skinSlots), mask = new Float32Array(position.count);
  geo.setAttribute(maskName, new BufferAttribute(mask, 1));
  if (!slots.size || !skinWeight || !skinIndex || !mesh.skeleton) return 0;
  const { segments, scale } = fingerSegments(mesh);
  if (!scale) return 0;
  const seen = new Uint8Array(position.count), p = new Vector3(), delta = new Vector3();
  let active = 0;
  const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.index?.count ?? position.count, materialIndex: 0 }];
  for (const { start, count, materialIndex } of groups) {
    if (!slots.has(materialIndex)) continue;
    for (let j = start; j < start + count; j++) {
      const i = geo.index ? geo.index.getX(j) : j;
      if (seen[i]) continue;
      seen[i] = 1;
      p.fromBufferAttribute(position, i);
      let thin = 0;
      for (let k = 0; k < skinWeight.itemSize; k++) {
        const w = skinWeight.getComponent(i, k), s = segments[skinIndex.getComponent(i, k)];
        if (!(w > 0) || !s) continue;
        delta.subVectors(p, s.a);
        const t = MathUtils.clamp(delta.dot(s.axis), 0, s.length);
        // Skin-to-centerline radius as a proxy for half-thickness. The median
        // phalanx gives all fingers one size reference, independent of PMX units.
        const radius = delta.addScaledVector(s.axis, -t).length() / scale;
        thin += w * (1 - MathUtils.smoothstep(radius, .15, .65));
      }
      if (thin > 0) { mask[i] = Math.min(1, thin); active++; }
    }
  }
  return active;
}

// Direct, linear RGB only. A broad backlit lobe plus a stronger forward
// scattering lobe (light opposite the eye); N or V never supply thickness.
export function skinTransmission(paint, L, light) {
  const through = positionViewDirection.dot(L).negate().clamp();
  const back = normalView.dot(L).negate().clamp();
  return paint.mul(light).mul(vec3(.27, .075, .033)).mul(attribute(maskName, 'float'))
    .mul(back).mul(through.mul(through).mul(.7).add(.3));
}
