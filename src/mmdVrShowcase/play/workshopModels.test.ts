import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { makeBlower, makeHilt, makePunch } from './workshopModels';

it('keeps an open bubble nozzle and a die face at the shared muzzle, rather than aiming through the grip',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide});
  const blower=new Mesh(makeBlower(true),material), punch=new Mesh(makePunch(),material);
  const ray=new Raycaster(new Vector3(0,.025,-.20),new Vector3(0,0,1));
  // The centre of the bubble ring must be a real opening, the stamp a solid face.
  expect(ray.intersectObject(blower)[0].point.z).toBeGreaterThan(-.15);
  expect(ray.intersectObject(punch)[0].point.z).toBeCloseTo(-.174,2);
  ray.ray.origin.x=.043;
  expect(ray.intersectObject(blower)[0].point.z).toBeCloseTo(-.179,2);
  blower.geometry.dispose();punch.geometry.dispose();material.dispose();
});

it('seats the animated blade inside the emitter rim',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide}),hilt=new Mesh(makeHilt(),material);
  const ray=new Raycaster(new Vector3(0,.14,0),new Vector3(0,-1,0));
  expect(ray.intersectObject(hilt)[0].point.y).toBeLessThan(.107);
  ray.ray.origin.x=.026;
  expect(ray.intersectObject(hilt)[0].point.y).toBeGreaterThan(.107);
  hilt.geometry.dispose();material.dispose();
});
