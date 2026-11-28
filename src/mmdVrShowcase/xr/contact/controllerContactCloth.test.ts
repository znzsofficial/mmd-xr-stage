import { Matrix4, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createCustomBulletMmdPhysicsBackend } from '@yohawing/three-mmd-loader/physics';
import { expect, it, vi } from 'vitest';
import { createMmdRuntimeHandle } from '../../mmdRuntime/mmdRuntime';
import { getBulletModule } from '../../mmdRuntime/bulletModule';
import { createControllerContactHaptics } from './controllerContactHaptics';
import { handContactShape, handReferenceRadius } from './handContactProfile';

vi.mock('../../mmdRuntime/bulletModule', () => ({ getBulletModule: vi.fn() }));

it('keeps the same paused, skinned PMX hem on two tracked palms with zero haptics-only contact reads', async () => {
  const { createNodeBulletModule } = await import(new URL('../../../../scripts/node-bullet-stage.mjs', import.meta.url).href);
  const { clothSmokeFixture } = await import(new URL('../../../../scripts/cloth-smoke-fixture.js', import.meta.url).href);
  const module = await createNodeBulletModule();
  const collect = vi.spyOn(module, '_mmd_anim_bullet_world_collect_contacts');
  vi.mocked(getBulletModule).mockResolvedValue({ module, createCustomBulletMmdPhysicsBackend });
  const { pmx, vmd } = clothSmokeFixture();
  const sources = ['left', 'right'].map(handedness => ({ handedness, hand: {} }) as XRInputSource);
  const frame = { session: Object.assign(new EventTarget(), { visibilityState: 'visible', inputSources: sources }) } as unknown as XRFrame;
  async function run(alwaysPoll: boolean) {
    const hidden = new Matrix4().makeTranslation(0, -1000, 0), controllers = [hidden, hidden];
    const hands = Array.from({ length: 12 }, () => hidden.clone());
    const haptics = createControllerContactHaptics(), camera = new PerspectiveCamera();
    const rt = createMmdRuntimeHandle(new Scene(), { controllerColliders: () => controllers,
      handColliders: () => hands, handShape: handContactShape, handColliderRadius: () => handReferenceRadius(.08) });
    const read = vi.spyOn(rt, 'getControllerContactCount');
    try {
      const { modelId } = await rt.addModel(pmx, [pmx], { physics: true, transform: { scale: 1 } });
      await rt.loadMotion(vmd, 'body', modelId);
      const mesh = rt.getModelSurface(modelId)!.mesh, vertex = new Vector3();
      const hem = (index: number) => mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
      collect.mockClear();
      let ticks = 0;
      function step() {
        rt.update(.75, true, camera, 1, false, 1 / 60);
        ticks++;
        if (!alwaysPoll) haptics.advance(frame, 1 / 60, ticks * 1000 / 60, 'normal', read);
        else if (ticks % 2 === 0) { read(0); read(1); }
      }
      // The palms start clear so the native colliders re-arm before the stroke.
      hands[0].setPosition(.03, .35, 0); hands[6].setPosition(.09, .35, 0);
      for (let i = 0; i < 60; i++) step();
      const before = hem(2).y, trajectory = [];
      for (let i = 1; i <= 60; i++) {
        hands[0].elements[13] = hands[6].elements[13] = .35 + Math.min(i, 40) * .008;
        step(); trajectory.push(hem(2).toArray(), hem(3).toArray());
      }
      const measured = { calls: read.mock.calls.length, nativeCalls: collect.mock.calls.length, lift: hem(2).y - before, trajectory };
      if (!alwaysPoll) {
        // On the same paused actor, replace one hand with a controller. Count a real
        // clear approach and a real contact, then withdraw, lose and reacquire it.
        const pulse = vi.fn(() => true);
        const source = { handedness: 'left', gripSpace: {}, gamepad: { hapticActuators: [{ pulse }] } } as unknown as XRInputSource;
        haptics.bind(0, { source, tracked: () => true, speed: () => .4 });
        hands[0].copy(hidden); hands[6].copy(hidden);
        for (let pass = 1; pass <= 2; pass++) {
          controllers[0] = new Matrix4().copy(hidden);
          sources[0] = { handedness: 'left', hand: {} } as XRInputSource;
          read.mockClear();
          for (let i = 0; i < 45; i++) step();
          expect(read).not.toHaveBeenCalled();
          sources[0] = source; controllers[0].setPosition(.06, .05, 0);
          for (let i = 0; i < 12; i++) step();
          expect(read.mock.calls.length).toBeGreaterThan(0);
          expect(pulse).toHaveBeenCalledTimes(pass - 1);
          for (let i = 1; i <= 88; i++) { controllers[0].elements[13] = .05 + Math.min(i, 80) * .008; step(); }
          expect(pulse).toHaveBeenCalledTimes(pass);
          expect(read.mock.calls.every(([side]) => side === 0)).toBe(true);
        }
      }
      return measured;
    } finally { haptics.reset(); rt.dispose(); }
  }
  const baseline = await run(true), gated = await run(false);
  expect([baseline.calls, gated.calls]).toEqual([120, 0]);
  expect(baseline.nativeCalls).toBeGreaterThanOrEqual(60); // The first contact can grow the native result buffer.
  expect(gated.nativeCalls).toBe(0);
  expect(gated.trajectory).toEqual(baseline.trajectory);
  expect(gated.lift).toBeGreaterThan(.06);
  if (process.env.MMD_HAPTIC_METRICS) console.info('paused PMX hands', { reads: [baseline.calls, gated.calls],
    nativeCalls: [baseline.nativeCalls, gated.nativeCalls], lift: gated.lift, matchedVertexPositions: gated.trajectory.length });
});
