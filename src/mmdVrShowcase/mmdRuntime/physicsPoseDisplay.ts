import { MathUtils, Matrix4, Quaternion, Vector3, type Bone, type Object3D } from "three";
import type { MmdPhysicsMutableIndexBuffer, MmdPhysicsStepContext } from "@yohawing/three-mmd-loader/physics";

type Sample = {
  bone: Bone;
  rawP: Vector3;
  rawQ: Quaternion;
  shownP: Vector3;
  shownQ: Quaternion;
  target: Matrix4;
  frame: number;
  appliedFrame: number;
  translate: boolean;
  skirt: boolean;
  rest?: { p: Vector3; q: Quaternion; length: number; frame: number };
};

// Distance is expressed in link lengths, rotation in radians. The inner
// tolerance suppresses repeated reversals. Outside it, return smoothly to
// the authored drape, with a hard bound on display lag for real strokes.
const restShift = .008, maxShift = .05, restTurn = .012, maxTurn = .065;
const restTurnDot = Math.cos(restTurn * .5);
function followExcess(distance: number, inner: number, outer: number, settle: number) {
  return Math.max(settle * (1 - inner / distance), 1 - outer / distance);
}

function standingTarget(s: Sample, frame: number, settle: number, scale: Vector3) {
  const rest = s.rest ??= { p: new Vector3(), q: new Quaternion(), length: 0, frame: -1 };
  if (rest.frame !== frame - 1) {
    rest.p.copy(s.shownP); rest.q.copy(s.shownQ);
    rest.length = Math.max(.001, s.rawP.length());
  } else {
    // Move by the excess only. Releasing accumulated error all at once would
    // turn several barely visible reversals into one conspicuous skipped pose.
    const travel = rest.p.distanceTo(s.shownP) / rest.length;
    if (travel > restShift) rest.p.lerp(s.shownP, followExcess(travel, restShift, maxShift, settle));
    const dot = Math.min(1, Math.abs(rest.q.dot(s.shownQ)));
    if (dot < restTurnDot) {
      const angle = 2 * Math.acos(dot);
      rest.q.slerp(s.shownQ, followExcess(angle, restTurn, maxTurn, settle));
    }
  }
  rest.frame = frame;
  s.target.compose(rest.p, rest.q, scale);
}

// Filter in a common space: averaging local rotations along a long chain
// accumulates errors even when the actual hem has barely moved. Restore raw
// local transforms before animation, IK and collision detection see them.
export class PhysicsPoseDisplay {
  private samples = new Map<Object3D, Sample>();
  private active: Sample[] = [];
  private frame = 0;
  private indices?: MmdPhysicsMutableIndexBuffer;
  private count = 0;
  private bodies: MmdPhysicsStepContext["rigidBodies"];
  private translated = new Set<number>();
  private p = new Vector3();
  private q = new Quaternion();
  private scale = new Vector3();
  private basisMatrix = new Matrix4();
  private local = new Matrix4();

  record = (indices: MmdPhysicsMutableIndexBuffer | undefined, count: number, bodies: MmdPhysicsStepContext["rigidBodies"]) => {
    if (this.bodies !== bodies) {
      this.bodies = bodies;
      this.translated.clear();
      const seen = new Set<number>();
      // The backend uses the first dynamic body for each bone. A
      // dynamic-with-bone body owns rotation only. Keep its animated offset.
      for (const body of bodies ?? []) {
        if (body.motionType === "static" || body.boneIndex == null || seen.has(body.boneIndex)) continue;
        seen.add(body.boneIndex);
        if (body.motionType === "dynamic") this.translated.add(body.boneIndex);
      }
      ++this.frame;
    }
    this.indices = indices; this.count = count;
  };

  restore(reset = false) {
    for (const s of this.active) { s.bone.position.copy(s.rawP); s.bone.quaternion.copy(s.rawQ); }
    this.active.length = 0; this.count = 0;
    if (reset) this.invalidate();
  }

  // The next evaluation must still restore the current raw local transforms.
  // Invalidate only the history when the stage moves or rescales this actor.
  invalidate() { ++this.frame; }

  present(bones: Bone[], dt: number, standing = false) {
    ++this.frame;
    const alpha = -Math.expm1(-Math.max(0, dt) / 0.065);
    const settle = standing ? -Math.expm1(-Math.max(0, dt) / .32) : 0;
    for (let i = 0; this.indices && i < this.count; ++i) {
      const index = this.indices[i];
      const bone = bones[index];
      if (!bone?.parent) continue;
      bone.matrixWorld.decompose(this.p, this.q, this.scale);
      let s = this.samples.get(bone);
      if (!s) {
        const skirt = [bone.name, bone.userData.mmdBoneName, bone.userData.mmdEnglishBoneName]
          .some(n => typeof n === 'string' && /skirt|スカート|裙/i.test(n));
        s = { bone, rawP: new Vector3(), rawQ: new Quaternion(), shownP: new Vector3(), shownQ: new Quaternion(), target: new Matrix4(), frame: -1, appliedFrame: -1, translate: false, skirt };
        this.samples.set(bone, s);
      }
      s.rawP.copy(bone.position); s.rawQ.copy(bone.quaternion);
      if (s.frame !== this.frame - 1) {
        s.translate = this.translated.has(index);
        s.shownP.copy(this.p); s.shownQ.copy(this.q);
      } else {
        // A short filter for tiny corrections. Bypass it for travel above
        // 28% of the local link length, or turns above about 23 degrees.
        const follow = MathUtils.smoothstep(s.shownP.distanceTo(this.p) / Math.max(0.001, bone.position.length()), 0.05, 0.28);
        const ang = MathUtils.smoothstep(1 - Math.min(1, Math.abs(s.shownQ.dot(this.q))), 0.001, 0.02);
        s.shownP.lerp(this.p, alpha + (1 - alpha) * follow);
        s.shownQ.slerp(this.q, alpha + (1 - alpha) * ang);
      }
      if (standing && s.skirt) standingTarget(s, this.frame, settle, this.scale);
      else s.target.compose(s.shownP, s.shownQ, this.scale);
      s.frame = this.frame; this.active.push(s);
    }
    for (const s of this.active) this.apply(s);
  }

  private apply(s: Sample) {
    if (s.appliedFrame === this.frame) return;
    const parent = s.bone.parent!;
    let ancestor: Object3D | null = parent;
    let basis: Sample | undefined;
    while (ancestor) {
      basis = this.samples.get(ancestor);
      if (basis?.frame === this.frame) break;
      ancestor = ancestor.parent;
    }
    if (ancestor && basis) {
      this.apply(basis);
      if (ancestor === parent) this.basisMatrix.copy(basis.target);
      else this.basisMatrix.copy(ancestor.matrixWorld).invert().premultiply(basis.target).multiply(parent.matrixWorld);
    } else this.basisMatrix.copy(parent.matrixWorld);
    this.local.copy(this.basisMatrix).invert().multiply(s.target).decompose(this.p, s.bone.quaternion, this.scale);
    if (s.translate) s.bone.position.copy(this.p);
    else { // Children must use the actual displayed parent position, not a filtered offset.
      this.p.copy(s.rawP).applyMatrix4(this.basisMatrix);
      s.target.setPosition(this.p);
    }
    s.appliedFrame = this.frame;
  }
}
