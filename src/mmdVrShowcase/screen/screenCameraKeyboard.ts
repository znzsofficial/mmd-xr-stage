import { Quaternion,Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const cameraKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyC', 'KeyR']);
const up = new Vector3(0, 1, 0);
const metresPerSecond = 2.4;
const radiansPerSecond = Math.PI / 2;

/** Translate the orbit rig together; yaw changes the aim around the eye, not the eye around the subject. */
export function bindScreenCameraKeyboard(viewport: HTMLElement, orbit: OrbitControls, reset: () => void) {
  const held = new Set<string>();
  const offset = new Vector3();
  const tangent=new Quaternion().setFromUnitVectors(orbit.object.up,up).invert();
  const clear = () => held.clear();
  const axis = (positive: string, negative: string) => Number(held.has(positive)) - Number(held.has(negative));
  function keyDown(e: KeyboardEvent) {
    if (e.target !== viewport || !orbit.enabled || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !cameraKeys.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyR') { clear(); reset(); }
    else held.add(e.code);
  }
  const keyUp = (e: KeyboardEvent) => held.delete(e.code);
  viewport.addEventListener('keydown', keyDown);
  viewport.addEventListener('keyup', keyUp);
  viewport.addEventListener('blur', clear);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);

  return {
    clear,
    step(delta: number) {
      if (!held.size || !orbit.enabled) return;
      const dt = Math.min(delta, .1);
      const yaw = axis('KeyE', 'KeyQ') * radiansPerSecond * dt;
      const heading = orbit.getAzimuthalAngle() + yaw;
      const eye = orbit.object.position;
      if (yaw) orbit.target.sub(eye).applyAxisAngle(orbit.object.up, yaw).add(eye);

      const forward = axis('KeyW', 'KeyS'), right = axis('KeyD', 'KeyA'), rise = axis('KeyF', 'KeyC');
      const sin = Math.sin(heading), cos = Math.cos(heading);
      offset.set(right * cos - forward * sin, rise, -right * sin - forward * cos)
        .applyQuaternion(tangent).normalize().multiplyScalar(metresPerSecond * dt);
      eye.add(offset);
      orbit.target.add(offset);
      orbit.update();
    },
    dispose() {
      clear();
      viewport.removeEventListener('keydown', keyDown);
      viewport.removeEventListener('keyup', keyUp);
      viewport.removeEventListener('blur', clear);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    },
  };
}
