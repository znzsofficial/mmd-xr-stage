import type { CustomBulletMmdModule, CustomBulletMmdPhysicsBackendOptions, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';

type Bodies = NonNullable<MmdPhysicsStepContext['rigidBodies']>;
type ReadCenters = (indices: readonly number[], positions: Float32Array) => boolean;
const MIN_MODEL_BODIES = 256;
const MIN_CONTACT_POINTS = 128;
const CONTACT_POINT_BYTES = 48;

// Enclose each complete native primitive at any rotation. Bullet clamps shape
// sizes to at least .0001; the extra room also covers the collision margin and
// positive contact-breaking threshold (2% of the bounding-box angular disc).
function outerRadius({ type, size: [x, y, z] }: Bodies[number]['shape']) {
  const radius = type === 'box' ? Math.hypot(x, y, z) : type === 'capsule' ? Math.abs(x) + Math.abs(y) / 2 : Math.abs(x);
  return 1.1 * radius + .1;
}

/** A negative controller-count proof for one busy world. Never supplies a positive contact. */
export class ControllerContactBounds {
  private bodies?: Bodies;
  private indices: number[] = [];
  private radii: number[] = [];
  private centers = new Float32Array(0);
  private clear = false;
  private denseRead = false;
  private checkNextStep = false;
  private sinceQuery = Infinity;
  private remainingSteps = 0;
  private timed = false;
  private prepMs = 0;

  accountForStepWork(report: NonNullable<CustomBulletMmdPhysicsBackendOptions['onStepWork']>): typeof report {
    this.timed = true;
    return (feed, world, outputs, seed) => {
      // The loader's world bracket surrounds this observer and the C call.
      const prep = seed ? 0 : Math.min(world, this.prepMs);
      report(feed + prep, world - prep, outputs, seed);
    };
  }

  // Observe the public step ABI after ALL kinematic/toggle writes and before
  // Bullet dispatches collisions. A post-solve center can miss a fast body.
  observe(module: CustomBulletMmdModule, read: ReadCenters): CustomBulletMmdModule {
    const local: CustomBulletMmdModule = Object.create(module);
    if (module._mmd_anim_bullet_world_collect_contacts) {
      local._mmd_anim_bullet_world_collect_contacts = (world, output, capacity, count) => {
        const status = module._mmd_anim_bullet_world_collect_contacts!(world, output, capacity, count);
        this.denseRead = false;
        if (status === 0 && this.bodies && capacity >= MIN_CONTACT_POINTS && output > 0 && count > 0) {
          // Mirror the facade's post-call heap refresh. A size probe, failed
          // growth or unusable record buffer cannot prove an empty range.
          module.refreshMemoryViews?.();
          const ints = module.HEAPU32, floats = module.HEAPF32;
          const total = ints?.[count >>> 2];
          this.denseRead = total !== undefined && total >= Math.max(MIN_CONTACT_POINTS, this.bodies.length / 8)
            && total <= capacity && floats !== undefined && floats.buffer === ints?.buffer
            && (count & 3) === 0 && (output & 3) === 0 && output + total * CONTACT_POINT_BYTES <= floats.byteLength;
        }
        return status;
      };
    }
    local._mmd_anim_bullet_world_step = (world, dt, maxSteps, fixed) => {
      if (this.checkNextStep) {
        this.checkNextStep = false;
        // Allow for float rounding at the accumulator boundary. A longer call
        // could solve an intermediate pose we cannot observe via the C API.
        const single = maxSteps > 0 && dt >= 0 && (maxSteps === 1 || dt < .99999 * fixed);
        if (single) {
          const start = this.timed ? performance.now() : 0;
          this.clear = read(this.indices, this.centers) && this.separated();
          if (this.timed) this.prepMs = performance.now() - start;
        }
      }
      const status = module._mmd_anim_bullet_world_step(world, dt, maxSteps, fixed);
      if (status !== 0) this.clear = false;
      return status;
    };
    return local;
  }

  beforeStep(bodies: Bodies | undefined, slots: number) {
    this.prepMs = 0;
    // Only the controller slots are present here; hand and prop wrappers
    // append farther down the chain. Small models always use the native read.
    const eligible = slots === 2 && bodies && bodies.length - slots >= MIN_MODEL_BODIES ? bodies : undefined;
    if (eligible !== this.bodies) {
      this.bodies = eligible;
      this.invalidate();
      this.indices = [];
    }
    this.checkNextStep = this.clear && this.sinceQuery < 8 && this.remainingSteps > 0;
    if (this.checkNextStep) {
      this.sinceQuery++;
      this.remainingSteps--;
    }
    // Seed-only calls do not reach world_step. Missing observations, resets,
    // failures and a consumer which stopped polling all fall back to Bullet.
    this.clear = false;
    this.denseRead = false;
  }

  private separated() {
    const first = this.indices.length - 2, c = this.centers;
    for (let grip = first; grip < first + 2; grip++) {
      const x = c[3*grip], y = c[3*grip+1], z = c[3*grip+2];
      for (let i = 0; i < first; i++) {
        const r = this.radii[i] + this.radii[grip];
        const gap = Math.max(Math.abs(x-c[3*i]), Math.abs(y-c[3*i+1]), Math.abs(z-c[3*i+2]));
        if (!Number.isFinite(gap) || !(gap > r)) return false;
      }
    }
    return true;
  }

  canSkip() {
    this.sinceQuery = 0;
    this.denseRead = false;
    return this.clear;
  }

  observedCount(count: number) {
    // Carry zero through zero-substep calls ONLY if the old manifold set was
    // already clear. After a hit/near pass we need a new exact empty read.
    this.clear = this.denseRead && count === 0 && this.bodies !== undefined;
    if (this.clear && this.bodies) {
      // Recheck actual collection density periodically even if both grips
      // stay far away: a changing pose can make a formerly busy world sparse.
      this.remainingSteps = 72;
      if (!this.indices.length) {
        this.indices = this.bodies.map((_, index) => index);
        this.radii = this.bodies.map(body => outerRadius(body.shape));
        this.centers = new Float32Array(this.bodies.length * 3);
      }
    }
  }

  invalidate() {
    this.clear = false;
    this.denseRead = false;
    this.checkNextStep = false;
    this.sinceQuery = Infinity;
  }
}
