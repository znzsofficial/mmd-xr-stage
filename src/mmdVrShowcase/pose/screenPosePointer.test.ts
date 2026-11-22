// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { CircleGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, type Ray, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bindScreenPosePointer } from './screenPosePointer';
import { poseTranslation } from './poseGesture';

it('captures a real ray hit before OrbitControls and model click, commits only the owning release, and leaves background drags to orbit', () => {
  const canvas = document.createElement('canvas'), wrapper = document.createElement('div');
  wrapper.append(canvas); document.body.append(wrapper);
  Object.defineProperty(canvas,'clientHeight',{value:400}); Object.defineProperty(canvas,'clientWidth',{value:400});
  canvas.getBoundingClientRect = () => new DOMRect(0,0,400,400);
  canvas.setPointerCapture = vi.fn(); canvas.releasePointerCapture = vi.fn();
  const camera = new PerspectiveCamera(50,1,.03,100); camera.position.z = 3; camera.updateMatrixWorld();
  const orbit = new OrbitControls(camera,canvas), eye = camera.position.clone();
  const pick = new Mesh(new CircleGeometry(.22),new MeshBasicMaterial());
  const click = vi.fn(); wrapper.addEventListener('click',click);
  let owner: number | undefined, sample: ((r: Ray,out: Vector3) => boolean) | undefined;
  const pos = new Vector3(), before = new Vector3();
  const release = vi.fn((cancel: boolean) => { if (cancel) pos.copy(before); canvas.releasePointerCapture(owner!); owner = undefined; });
  const dispose = bindScreenPosePointer(canvas,camera,{
    enabled: () => true, targets: () => [pick], owner: () => owner,
    begin(_mesh,ray,hit,e) {
      owner = e.pointerId; canvas.setPointerCapture(owner); before.copy(pos);
      sample = poseTranslation(ray,hit,pos,camera.getWorldDirection(new Vector3()),false); return true;
    }, move: r => { sample?.(r,pos); }, release,
  });
  const pointer = (event: string,x: number,y: number,id = 1,buttons = 1) => canvas.dispatchEvent(new PointerEvent(event,
    { pointerId:id, pointerType:'mouse', isPrimary:true, clientX:x, clientY:y, button:0, buttons, bubbles:true, cancelable:true }));
  try {
    pointer('pointerdown',200,200); pointer('pointerup',100,100,2,0); pointer('lostpointercapture',0,0,2);
    expect(owner).toBe(1); expect(release).not.toHaveBeenCalled();
    pointer('pointermove',290,260); pointer('pointerup',290,260,1,0); canvas.click();
    expect(pos.x).toBeGreaterThan(.4); expect(pos.y).toBeLessThan(-.3); expect(pos.z).toBe(0);
    expect(release).toHaveBeenCalledExactlyOnceWith(false); expect(click).not.toHaveBeenCalled(); expect(camera.position.distanceTo(eye)).toBe(0);
    const last = pos.clone();
    pointer('pointerdown',200,200); pointer('pointermove',100,100); pointer('lostpointercapture',100,100);
    expect(release).toHaveBeenLastCalledWith(true); expect(pos.equals(last)).toBe(true); expect(owner).toBeUndefined();
    pointer('pointerdown',35,35); pointer('pointermove',95,40); pointer('pointerup',95,40,1,0); canvas.click();
    expect(camera.position.distanceTo(eye)).toBeGreaterThan(.1); expect(click).toHaveBeenCalledOnce(); expect(pos.equals(last)).toBe(true);
  } finally { dispose(); orbit.dispose(); pick.geometry.dispose(); pick.material.dispose(); wrapper.remove(); }
});
