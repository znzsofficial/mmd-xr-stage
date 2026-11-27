import { MathUtils, Quaternion, Vector3, type Bone, type Object3D, type SkinnedMesh } from 'three';
import type { PelvicFrame } from './contract';

const sky = new Vector3(0, 1, 0);
const { smoothstep, clamp } = MathUtils;

function actorLandmarks(root: Object3D, anchor: Object3D) {
  let bones: Bone[] = [];
  root.traverse(node => {
    const skeleton = (node as SkinnedMesh).skeleton;
    if (skeleton && ((anchor === root && !bones.length) || skeleton.bones.includes(anchor as Bone))) bones = skeleton.bones;
  });
  const names = new Map<string, Bone>();
  for (const bone of bones) for (const name of [bone.userData.mmdBoneName, bone.userData.mmdEnglishBoneName, bone.name]) {
    if (typeof name !== 'string') continue;
    const key = name.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g, '').replace(/^mixamorig/, '');
    if (!names.has(key)) names.set(key, bone);
  }
  function joint(...keys: string[]) { for (const key of keys) if (names.has(key)) return names.get(key); }
  const sides = ['left', 'right'].map((side, i) => {
    const prefix = i ? '右' : '左', initial = side[0];
    function sided(jp: string[], en: string[]) {
      return joint(...jp.map(n => prefix + n), ...en.flatMap(n => [side + n, n + initial, initial + n]));
    }
    return {
      shoulder: sided(['腕', '肩'], ['upperarm', 'arm', 'shoulder', 'clavicle']),
      hip: sided(['足', '大腿', '脚'], ['thigh', 'upleg', 'upperleg']),
      knee: sided(['ひざ', '膝'], ['knee', 'lowerleg', 'shin', 'calf', 'leg']),
    };
  });
  return { neck: joint('首', 'neck', '頭', '头', 'head'), sides };
}

/** All targets come from this draw's pose. Only the choice of flank during
 * a partial turn carries over, while both the anchor and torso are continuous. */
export function createPartnerStance(actor: Object3D, anchor: Object3D) {
  const bones = actorLandmarks(actor, anchor);
  const entry = new Vector3(), hip = new Vector3(), neck = new Vector3(), up = new Vector3(), left = new Vector3();
  const out = new Vector3(), front = new Vector3(), feet = new Vector3(), span = new Vector3(), turn = new Quaternion();
  const sides = bones.sides.map(() => ({ shoulder: new Vector3(), hip: new Vector3(), knee: new Vector3() }));
  const pose = { entry, hip, neck, left, out, sides, lateral: 0, rear: 0, roll: 0 };
  const previousEntry = new Vector3(), previousFrame = new Quaternion(), previousUp = new Vector3(), previousLeft = new Vector3();
  let previousScale = 0, previousYaw = 0, turning = false;
  function read(bone: Bone | undefined, p: Vector3, scale: number) {
    if (bone) {
      bone.getWorldPosition(p);
      if (p.distanceToSquared(entry) < (2.5 * scale) ** 2) return true;
    }
    p.set(NaN, NaN, NaN);
    return false;
  }
  function usable(v: Vector3, scale: number) { return v.lengthSq() > (.012 * scale) ** 2; }

  return (f: PelvicFrame, visible: boolean) => {
    entry.setFromMatrixPosition(f.world);
    const rotation = turn.setFromRotationMatrix(f.world);
    const continuous = visible && Math.abs(f.scale - previousScale) < f.scale * .01 &&
      previousEntry.distanceToSquared(entry) < (.32 * f.scale) ** 2 && Math.abs(previousFrame.dot(rotation)) > .96;
    previousEntry.copy(entry); previousFrame.copy(rotation); previousScale = f.scale;
    for (const [i, bone] of bones.sides.entries()) {
      read(bone.shoulder, sides[i].shoulder, f.scale);
      read(bone.hip, sides[i].hip, f.scale);
      read(bone.knee, sides[i].knee, f.scale);
    }
    hip.lerpVectors(sides[0].hip, sides[1].hip, .5);
    if (!Number.isFinite(hip.x)) hip.copy(entry);
    if (!read(bones.neck, neck, f.scale)) neck.lerpVectors(sides[0].shoulder, sides[1].shoulder, .5);
    up.subVectors(neck, hip);
    if (!usable(up, f.scale)) up.setFromMatrixColumn(f.world, 1);
    up.normalize();

    // Average directions, not widths: a broad-shouldered rig can still twist
    // at the waist. A missing or folded-in pair must not cancel a good span.
    left.subVectors(sides[0].shoulder, sides[1].shoulder);
    if (usable(left, f.scale)) left.normalize(); else left.set(0, 0, 0);
    span.subVectors(sides[0].hip, sides[1].hip);
    if (usable(span, f.scale)) left.addScaledVector(span.normalize(), .72);
    left.addScaledVector(up, -left.dot(up));
    if (left.lengthSq() < .01) {
      left.setFromMatrixColumn(f.world, 0);
      left.addScaledVector(up, -left.dot(up));
      if (left.lengthSq() < .01) left.crossVectors(up, front.setFromMatrixColumn(f.world, 2));
    }
    left.normalize(); front.crossVectors(left, up).normalize();
    const samePose = continuous && up.dot(previousUp) > .88 && left.dot(previousLeft) > .88;
    previousUp.copy(up); previousLeft.copy(left);
    const reclined = 1 - smoothstep(Math.abs(up.y), .48, .88);
    pose.lateral = reclined * smoothstep(Math.abs(left.y), .36, .93);
    pose.rear = reclined * smoothstep(-front.y, .22, .79);

    // Flatten the *body* basis, not the pitched tool. At the vertical-port
    // singularity use the headward line. Through a forward bend, turn via a
    // flank rather than normalizing two opposing horizontal directions.
    out.copy(front).applyQuaternion(turn.setFromUnitVectors(up, sky)).setY(0).normalize();
    out.applyAxisAngle(sky, Math.PI * pose.rear);
    feet.copy(up).negate().setY(0);
    if (reclined && feet.lengthSq() > .01) {
      feet.normalize().applyAxisAngle(sky, -Math.sign(left.y) * Math.PI / 2 * pose.lateral);
      let yaw = Math.atan2(out.z * feet.x - out.x * feet.z, clamp(out.dot(feet), -1, 1));
      // At a half-turn either flank works. Keep the same branch on adjacent
      // frames (including a reversible edit); a cut or remount chooses afresh.
      if (samePose && turning) yaw += 2 * Math.PI * Math.round((previousYaw - yaw) / (2 * Math.PI));
      previousYaw = yaw;
      out.applyAxisAngle(sky, yaw * reclined);
    }
    turning = reclined > 0 && reclined < 1;
    pose.roll = Math.sign(left.y) * pose.lateral * 1.48;
    return pose;
  };
}
