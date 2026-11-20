// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bindScreenCameraKeyboard } from './screenCameraKeyboard';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function rig() {
  const view = document.createElement('div'), canvas = document.createElement('canvas');
  view.append(canvas);
  const camera = new PerspectiveCamera();
  camera.position.set(1, 3, 6);
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(1, 1, 0);
  orbit.update();
  const reset = vi.fn(), keys = bindScreenCameraKeyboard(view, orbit, reset);
  cleanups.push(() => { keys.dispose(); orbit.dispose(); });
  const press = (code: string, type = 'keydown', init: KeyboardEventInit = {}, target: HTMLElement = view) =>
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, code, ...init }));
  return { view, camera, orbit, reset, keys, press };
}

it('turns at the eye, then tracks the new horizontal heading without changing pitch or orbit distance', () => {
  const { camera, orbit, keys, press } = rig();
  press('KeyQ');
  for (let i = 0; i < 60; i++) keys.step(1 / 60);
  press('KeyQ', 'keyup');
  expect(camera.position.distanceTo(new Vector3(1, 3, 6))).toBeLessThan(1e-9);
  expect(orbit.target.distanceTo(new Vector3(7, 1, 6))).toBeLessThan(1e-9);

  press('KeyW');
  for (let i = 0; i < 30; i++) keys.step(1 / 30);
  expect(camera.position.distanceTo(new Vector3(3.4, 3, 6))).toBeLessThan(1e-9);
  expect(orbit.target.distanceTo(new Vector3(9.4, 1, 6))).toBeLessThan(1e-9);
});

it('drops held keys on focus loss, leaves controls and shortcuts alone, and resets once per press', () => {
  const { view, camera, orbit, keys, press, reset } = rig();
  const input = document.createElement('input'); view.append(input);
  const eye = camera.position.clone();
  press('KeyF'); view.dispatchEvent(new Event('blur')); keys.step(.1);
  expect(press('KeyF', 'keydown', {}, input)).toBe(true);
  expect(press('KeyF', 'keydown', { ctrlKey: true })).toBe(true);
  orbit.enabled = false; expect(press('KeyF')).toBe(true); orbit.enabled = true;
  keys.step(.1); expect(camera.position.equals(eye)).toBe(true);
  press('KeyW'); press('KeyR'); press('KeyR', 'keydown', { repeat: true });
  keys.step(.1); expect(reset).toHaveBeenCalledTimes(1); expect(camera.position.equals(eye)).toBe(true);
});

it('keeps wheel zoom centred on the new orbit target after keyboard translation and yaw', () => {
  const { view, camera, orbit, keys, press } = rig();
  press('KeyW'); press('KeyQ'); keys.step(.1); keys.clear();
  const target = orbit.target.clone(), direction = camera.getWorldDirection(new Vector3());
  const distance = () => camera.position.distanceTo(target);
  const start = distance(), canvas = view.querySelector('canvas')!;
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, cancelable: true }));
  const near = distance(); expect(near).toBeLessThan(start);
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, cancelable: true }));
  expect(distance()).toBeGreaterThan(near); expect(orbit.target.equals(target)).toBe(true);
  expect(camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-9);
});
