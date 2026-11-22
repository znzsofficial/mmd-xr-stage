import { expect, it } from 'vitest';
import { PerspectiveCamera, Ray, Raycaster, Vector2, Vector3 } from 'three';
import { poseDial, poseTranslation } from './poseGesture';

it('screen movement retains both acquisition offset and eye-plane depth at an oblique camera angle', () => {
  const camera = new PerspectiveCamera(50,1.6,.03,100);
  camera.position.set(2,1,3); camera.lookAt(0,.7,-1); camera.updateMatrixWorld();
  const raycaster = new Raycaster(); raycaster.setFromCamera(new Vector2(.2,-.15),camera);
  const ray = raycaster.ray, hit = ray.at(3,new Vector3()), center = hit.clone().add(new Vector3(.03,.02,.01));
  const normal = camera.getWorldDirection(new Vector3()).negate(), out = new Vector3();
  const sample = poseTranslation(ray,hit,center,normal,false);
  expect(sample(ray,out)).toBe(true); expect(out.distanceTo(center)).toBeLessThan(1e-12);
  raycaster.setFromCamera(new Vector2(-.4,.5),camera); sample(ray,out);
  expect(Math.abs(out.clone().sub(center).dot(normal))).toBeLessThan(1e-12);
  const grabbedPixel = out.clone().sub(center).add(hit).project(camera);
  expect(grabbedPixel.x).toBeCloseTo(-.4,10); expect(grabbedPixel.y).toBeCloseTo(.5,10);
});

it('a captured XR ray transports the joint when the controller translates in depth or turns away from the original hit', () => {
  const center = new Vector3(.21,.8,-1.1), ray = new Ray(new Vector3(.2,.8,.4),new Vector3(0,0,-1));
  const hit = ray.at(1.5,new Vector3()), out = new Vector3();
  const sample = poseTranslation(ray,hit,center,new Vector3(0,0,1),true);
  ray.origin.z -= .25; sample(ray,out);
  expect(out.toArray()).toEqual([.21,.8,-1.35]);
  ray.direction.set(-1,0,0); sample(ray,out);
  expect(out.distanceTo(new Vector3(-1.29,.8,.15))).toBeLessThan(1e-12);
});

it('a rotation dial crosses the angle seam in small increments and reacquires without a flip after crossing its center', () => {
  const normal = new Vector3(0,0,1), ray = new Ray(new Vector3(),new Vector3(0,0,-1));
  const at = (deg: number, r = 1) => { ray.origin.set(r*Math.cos(deg*Math.PI/180),r*Math.sin(deg*Math.PI/180),1); return ray; };
  const step = poseDial(at(175),new Vector3(),normal,.2);
  expect(step(at(-175))).toBeCloseTo(Math.PI/18,10);
  expect(step(at(0,.05))).toBe(0); expect(step(at(5))).toBe(0);
  expect(step(at(0))).toBeCloseTo(-Math.PI/36,10);
});
