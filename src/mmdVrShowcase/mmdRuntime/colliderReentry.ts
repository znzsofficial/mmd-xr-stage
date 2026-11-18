import type { MmdPhysicsRigidBodyShape, MmdPhysicsStepContext } from "@yohawing/three-mmd-loader/physics";

export const syntheticColliderBody = Symbol("syntheticColliderBody");
export const PARK_Y = -1000;
type ReadCenters = (indices: readonly number[], out: Float32Array) => boolean;
type Slot = { offset: number; radius: number; x: number; y: number; z: number; seen: boolean; cooling: number };

function extent({ type, size: [x, y, z] }: MmdPhysicsRigidBodyShape) {
  return type === "sphere" ? x : type === "capsule" ? x + y / 2 : Math.hypot(x, y, z);
}

/** Only a discontinuous input needs clearance. Continuous fast strokes go straight to Bullet. */
export class ColliderReentry {
  private bodies: MmdPhysicsStepContext["rigidBodies"];
  private slots: Slot[] = [];
  private dynamic: number[] = [];
  private radii: number[] = [];
  private centers = new Float32Array();

  constructor(private readCenters: ReadCenters, private modelScale: () => number) {}

  apply(context: MmdPhysicsStepContext, dt: number) {
    const { rigidBodies, inputWorldMatricesColumnMajor: matrices } = context;
    // Both collider wrappers own the appended Float32Array tail, in copied and direct mode.
    if (!rigidBodies || !(matrices instanceof Float32Array)) return;
    if (this.bodies !== rigidBodies) {
      this.bodies = rigidBodies;
      this.slots = []; this.dynamic = []; this.radii = [];
      rigidBodies.forEach((body, i) => {
        if (syntheticColliderBody in body && body.boneIndex != null) {
          this.slots.push({ offset: body.boneIndex * 16 + 12, radius: extent(body.shape), x: 0, y: 0, z: 0, seen: false, cooling: 0 });
        } else if (body.motionType !== "static") {
          this.dynamic.push(i); this.radii.push(extent(body.shape));
        }
      });
      this.centers = new Float32Array(this.dynamic.length * 3);
    }
    let valid: boolean | undefined;
    const scale = this.modelScale(), jumpSq = (0.40 / scale) ** 2, clearance = .04 / scale;
    for (const slot of this.slots) {
      const i = slot.offset, x = matrices[i], y = matrices[i+1], z = matrices[i+2];
      const parked = x === 0 && y === PARK_Y && z === 0;
      if (parked || (slot.seen && (x-slot.x)**2 + (y-slot.y)**2 + (z-slot.z)**2 > jumpSq)) slot.cooling = 2/60;
      slot.x = x; slot.y = y; slot.z = z; slot.seen = true;
      if (parked || slot.cooling <= 0) continue;
      // Read native dynamic centers only on recovery, once per model/step, shared by all slots.
      valid ??= this.readCenters(this.dynamic, this.centers);
      let clear = valid;
      for (let j = 0; clear && j < this.dynamic.length; j++) {
        const r = slot.radius + this.radii[j] + clearance;
        clear = (x-this.centers[3*j])**2 + (y-this.centers[3*j+1])**2 + (z-this.centers[3*j+2])**2 > r*r;
      }
      if (clear) slot.cooling -= Math.max(0, dt);
      else {
        matrices[i] = 0; matrices[i+1] = PARK_Y; matrices[i+2] = 0;
        slot.cooling = 2/60;
      }
    }
  }
}
