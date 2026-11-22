import { Euler, Matrix4, Quaternion, Vector3, type Bone, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import type { PelvicCalibration, PelvicFrame, PelvicSocket } from './contract';

const hip = /^(下半身|骨盆|骨盘|hips?|pelvis|lowerbody)$/;
const waist = /^(腰|waist)$/;
const thighs = [ /^(左足|左脚|左大腿|left(?:upleg|upperleg|thigh)|(?:upleg|upperleg|thigh)l|lthigh)$/,
  /^(右足|右脚|右大腿|right(?:upleg|upperleg|thigh)|(?:upleg|upperleg|thigh)r|rthigh)$/ ];
const upper = /^(上半身2?|脊椎|spine\d*|chest|neck|首|頭|头|head)$/;
const knees = /^(左ひざ|右ひざ|[左右]膝|(?:left|right)(?:knee|leg|lowerleg)|(?:knee|shin)[lr])$/;
function named(b: Bone, re: RegExp) {
  return [b.userData.mmdBoneName, b.userData.mmdEnglishBoneName, b.name].some(s => typeof s === 'string' &&
    re.test(s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g, '').replace(/^mixamorig/, '')));
}
function usable(m: Matrix4) { return m.elements.every(Number.isFinite) && m.determinant() > 0; }

/** Fit once from bind matrices, even when invoked during a dance. The
 * estimated landmark is only a starting point; no mesh bounds or ray picks. */
export function registerPelvicSocket(root: Object3D, c: PelvicCalibration): PelvicSocket | null {
  const manual = c.manual;
  if (manual && (!(manual.unitsPerMeter > 0) || !Number.isFinite(manual.unitsPerMeter) || !manual.origin.every(Number.isFinite))) return null;
  root.updateWorldMatrix(true, true);
  const seen = new Set<Skeleton>();
  let found: PelvicSocket | null = null;
  root.traverse(node => {
    const mesh = node as SkinnedMesh, sk = mesh.skeleton;
    if (found || !mesh.isSkinnedMesh || !sk || seen.has(sk) || sk.bones.length !== sk.boneInverses.length) return;
    seen.add(sk);
    const idx = (r: RegExp) => sk.bones.findIndex(b => named(b, r));
    let i = idx(hip);
    if (i < 0) i = idx(waist);
    // Explicit manual registration may still follow a centre/root motion
    // bone if this incomplete skeleton has no anatomical lower-body bone.
    if (i < 0 && manual) i = idx(/^(center|centre|センター|groove|グルーブ)$/);
    if (i < 0 || !usable(sk.boneInverses[i])) return;
    const anchor = sk.bones[i], inv = sk.boneInverses[i];
    // Root-local authored coordinates -> bind world, independent of placement.
    const rootBind = mesh.matrixWorld.clone().invert().multiply(root.matrixWorld).premultiply(mesh.bindMatrix);
    if (!usable(rootBind)) return;
    if (manual) {
      const basis = new Matrix4().makeScale(manual.unitsPerMeter, manual.unitsPerMeter, manual.unitsPerMeter)
        .setPosition(...manual.origin).premultiply(rootBind).premultiply(inv);
      found = { anchor, basisInAnchor: basis, kind: 'manual' }; return;
    }
    const [li, ri] = thighs.map(idx);
    if (li < 0 || ri < 0 || !usable(sk.boneInverses[li]) || !usable(sk.boneInverses[ri])) return;
    const rest = (j: number) => new Vector3().setFromMatrixPosition(sk.boneInverses[j].clone().invert());
    const left = rest(li), right = rest(ri), middle = left.clone().lerp(right, .5);
    const side = left.sub(right), spread = side.length();
    if (spread < 1e-5 || rest(i).distanceTo(middle) > 2 * spread) return;
    side.normalize();
    // Pelvis bone axes are often rolled. Prefer an independent vertical bind
    // landmark; a left/right pair and authored model up also define a frame.
    const u = idx(upper), k = idx(knees);
    const up = u >= 0 ? rest(u).sub(middle) : k >= 0 ? middle.clone().sub(rest(k)) : new Vector3(0,1,0).transformDirection(rootBind);
    up.addScaledVector(side, -up.dot(side));
    if (up.lengthSq() < 1e-10) return;
    up.normalize();
    const out = side.clone().cross(up);
    // Rest thigh span supplies an actor-relative ruler (typical reference
    // 20 cm). Bind-space size and live world scale each enter exactly once.
    const ruler = spread / .20;
    const entry = middle.addScaledVector(up, -.048*ruler).addScaledVector(out, .031*ruler);
    const basis = new Matrix4().makeBasis(side.multiplyScalar(ruler), up.multiplyScalar(ruler), out.multiplyScalar(ruler))
      .setPosition(entry).premultiply(inv);
    if (usable(basis)) found = { anchor, basisInAnchor: basis, kind: 'bones' };
  });
  if (found || !manual) return found;
  return { anchor: root, kind: 'manual', basisInAnchor: new Matrix4()
    .makeScale(manual.unitsPerMeter, manual.unitsPerMeter, manual.unitsPerMeter).setPosition(...manual.origin) };
}

const basis = new Matrix4(), p = new Vector3(), scale = new Vector3(), orientation = new Quaternion(), adjust = new Quaternion(), angles = new Euler();
const one = new Vector3(1,1,1), rad = Math.PI/180;
/** Call after render scale and displayed bones have been restored. Only the
 * anchor ancestry is updated, never skinning, the evaluator or controls. */
export function samplePelvicFrame(socket: PelvicSocket | null, c: PelvicCalibration, target?: PelvicFrame): PelvicFrame | null {
  if (!socket || !(c.radiusM > 0 && c.lengthM > 0) || !Number.isFinite(c.radiusM+c.lengthM+c.pitchDeg+c.yawDeg) || !c.offsetM.every(Number.isFinite)) return null;
  for (let n: Object3D | null = socket.anchor; n; n = n.parent) if (!n.visible) return null;
  socket.anchor.updateWorldMatrix(true, false);
  basis.multiplyMatrices(socket.anchor.matrixWorld, socket.basisInAnchor);
  if (!usable(basis)) return null;
  basis.decompose(p, orientation, scale);
  // The actor transform is uniform in this product; an anisotropic or sheared
  // attachment would have no single metre ruler and could not retain a circle.
  if (Math.abs(scale.x-scale.y) + Math.abs(scale.z-scale.y) > scale.y*.002 || Math.abs(orientation.lengthSq()-1)>.001) return null;
  orientation.normalize().multiply(adjust.setFromEuler(angles.set(c.pitchDeg*rad, c.yawDeg*rad, 0, 'YXZ')));
  p.fromArray(c.offsetM).applyMatrix4(basis);
  const f = target ?? { world: new Matrix4(), inverse: new Matrix4(), radiusM: 0, lengthM: 0, scale: 0 };
  f.world.compose(p, orientation, one); f.inverse.copy(f.world).invert(); f.scale = scale.y;
  f.radiusM = c.radiusM*f.scale; f.lengthM = c.lengthM*f.scale;
  return f;
}
