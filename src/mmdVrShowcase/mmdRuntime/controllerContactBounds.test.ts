import { expect, it, vi } from 'vitest';
import type { CustomBulletMmdModule, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';
import { ControllerContactBounds } from './controllerContactBounds';

const countPointer = 4, outputPointer = 64, capacity = 256;
function heapViews() {
  const buffer = new ArrayBuffer(outputPointer + capacity * 48);
  const HEAPU32 = new Uint32Array(buffer);
  HEAPU32[countPointer / 4] = capacity;
  return { HEAPU32, HEAPF32: new Float32Array(buffer) };
}

it('checks the fed pre-solve pose; a displaced body and a retained zero-substep hit cannot be rejected', () => {
  const bodies: NonNullable<MmdPhysicsStepContext['rigidBodies']> = Array.from({length: 258}, (_, index) => ({
    index, motionType: 'dynamic', shape: {type: 'sphere', size: [.5, .5, .5]},
  }));
  const nativeStep = vi.fn(() => { positions[0] = 0; return 0; });
  const views = heapViews();
  const native = { _mmd_anim_bullet_world_step: nativeStep, _mmd_anim_bullet_world_collect_contacts: () => 0, ...views } as unknown as CustomBulletMmdModule;
  const positions = new Float32Array(bodies.length * 3);
  positions[256 * 3] = 7;
  positions[257 * 3] = -7;
  const read = vi.fn((_indices: readonly number[], out: Float32Array) => { out.set(positions); return true; });
  const bounds = new ControllerContactBounds();
  const observed = bounds.observe(native, read);
  function step(dt = 1 / 72) {
    bounds.beforeStep(bodies, 2);
    expect(observed._mmd_anim_bullet_world_step(1, dt, 5, 1 / 60)).toBe(0);
    return bounds.canSkip();
  }
  function empty() { observed._mmd_anim_bullet_world_collect_contacts!(1, outputPointer, capacity, countPointer); bounds.observedCount(0); }

  expect(step()).toBe(false); // No prior exact negative.
  empty();
  expect(step()).toBe(true);
  positions[0] = 7;
  expect(step()).toBe(false); // The solver has already moved it away when queried.
  expect(positions[0]).toBe(0);
  bounds.observedCount(1);
  expect(step(0)).toBe(false); // The manifold can still report last step's hit.
  expect(step()).toBe(false);
  empty();
  expect(step()).toBe(true);

  expect(step(1 / 30)).toBe(false); // Intermediate positions were not observed.
  empty();
  read.mockReturnValueOnce(false);
  expect(step()).toBe(false);
  empty();
  positions[0] = NaN;
  expect(step()).toBe(false);
  empty();
  bounds.beforeStep(bodies, 2); // A seek/seed never enters the native step.
  expect(bounds.canSkip()).toBe(false);

  views.HEAPU32[countPointer / 4] = capacity + 8; // Buffer growth failed: an empty JS result proves nothing.
  empty();
  expect(step()).toBe(false);
  views.HEAPU32[countPointer / 4] = capacity;
  empty();
  bounds.beforeStep([...bodies], 2);
  expect(bounds.canSkip()).toBe(false);
  empty();
  bounds.invalidate();
  expect(bounds.canSkip()).toBe(false);
  expect(native._mmd_anim_bullet_world_step).toBe(nativeStep); // No shared module mutation.
});

it('performs no center work for a small world or after the consumer stops polling', () => {
  const sphere = {index: 0, motionType: 'dynamic', shape: {type: 'sphere', size: [1, 1, 1]}} as const;
  const small = [sphere, sphere, sphere], heavy = Array(258).fill(sphere);
  const bounds = new ControllerContactBounds();
  const read = vi.fn((_indices: readonly number[], out: Float32Array) => { out.fill(100, 256 * 3); return true; });
  const module = bounds.observe({_mmd_anim_bullet_world_step: () => 0, _mmd_anim_bullet_world_collect_contacts: () => 0, ...heapViews()} as unknown as CustomBulletMmdModule, read);
  for (const bodies of [small, heavy]) {
    bounds.beforeStep(bodies, 2);
    expect(bounds.canSkip()).toBe(false);
    module._mmd_anim_bullet_world_collect_contacts!(1, outputPointer, capacity, countPointer);
    bounds.observedCount(0);
    for (let i = 0; i < 20; i++) {
      bounds.beforeStep(bodies, 2);
      module._mmd_anim_bullet_world_step(1, 1 / 72, 5, 1 / 60);
    }
    expect(bounds.canSkip()).toBe(false);
    expect(read).toHaveBeenCalledTimes(bodies === small ? 0 : 8);
  }
});

it('keeps a sparse 512-body world on exact reads, including after a dense garment separates', () => {
  const bodies = Array(514).fill({shape: {type:'sphere', size:[1,1,1]}});
  const bounds = new ControllerContactBounds();
  const read = vi.fn((_indices: readonly number[], out: Float32Array) => { out.fill(100, 512 * 3); return true; });
  let refreshed = heapViews();
  const native = { ...heapViews(), refreshMemoryViews() { Object.assign(this, refreshed); },
    _mmd_anim_bullet_world_step: () => 0, _mmd_anim_bullet_world_collect_contacts: () => 0 };
  const module = bounds.observe(native as unknown as CustomBulletMmdModule, read);
  function step() { bounds.beforeStep(bodies, 2); module._mmd_anim_bullet_world_step(1, 1/72, 5, 1/60); return bounds.canSkip(); }
  function poll(total: number, output = outputPointer) {
    refreshed = heapViews(); // Simulate a replaced heap whose count is only visible after refresh.
    refreshed.HEAPU32[countPointer / 4] = total;
    module._mmd_anim_bullet_world_collect_contacts!(1, output, capacity, countPointer);
    bounds.observedCount(0);
  }
  for (const count of [0, 1, 48]) { expect(step()).toBe(false); poll(count); }
  expect(step()).toBe(false);
  poll(capacity, outputPointer + 4); // Complete count, but truncated backing storage.
  expect(step()).toBe(false);
  expect(read).not.toHaveBeenCalled();
  poll(capacity);
  for (let i = 0; i < 72; i++) expect(step()).toBe(true);
  expect(step()).toBe(false); // Even continuously clear grips must reassess the current collection.
  poll(0);
  expect(step()).toBe(false);
  expect(read).toHaveBeenCalledTimes(72);
});

it('charges only center preparation to feed, including on the next seed or exact-only step', () => {
  const bounds = new ControllerContactBounds();
  const bodies = Array(258).fill({shape:{type:'sphere',size:[1,1,1]}});
  let clock = 0;
  const module = bounds.observe({ ...heapViews(), _mmd_anim_bullet_world_step: () => { clock += 3; return 0; },
    _mmd_anim_bullet_world_collect_contacts: () => 0 } as unknown as CustomBulletMmdModule, (_indices, out) => {
      clock += 7; out.fill(100, 256 * 3); return true;
    });
  const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  try {
    bounds.beforeStep(bodies, 2);
    bounds.canSkip(); module._mmd_anim_bullet_world_collect_contacts!(1, outputPointer, capacity, countPointer); bounds.observedCount(0);
    bounds.beforeStep(bodies, 2); module._mmd_anim_bullet_world_step(1, 1/72, 5, 1/60);
    expect(now).not.toHaveBeenCalled(); // No consumer installed a timing callback.
    const report = vi.fn(), onWork = bounds.accountForStepWork(report);
    bounds.beforeStep(bodies, 2); module._mmd_anim_bullet_world_step(1, 1/72, 5, 1/60);
    onWork(2, 10, 4, false);
    bounds.beforeStep(bodies, 2); onWork(8, 0, 3, true);
    bounds.beforeStep(bodies, 2); module._mmd_anim_bullet_world_step(1, 1/30, 5, 1/60);
    onWork(2, 3, 4, false);
    expect(now).toHaveBeenCalledTimes(2);
    expect(report.mock.calls).toEqual([[9, 3, 4, false], [8, 0, 3, true], [2, 3, 4, false]]);
  } finally { now.mockRestore(); }
});
