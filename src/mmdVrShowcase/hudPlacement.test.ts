import { expect, it } from "vitest";
import * as THREE from "three";
import { placeHudInFront } from "./hudPlacement";

it("recalls the menu ahead of the current head pose even after locomotion and turning", () => {
  const origin = new THREE.Group();
  origin.position.set(4, 0.5, -3);
  origin.rotation.y = Math.PI / 2;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0.2, 1.65, 0.1);
  camera.rotation.set(0.4, 0.3, 0);
  const panel = new THREE.Group();
  origin.add(camera, panel); origin.updateMatrixWorld(true);
  placeHudInFront(camera, origin, panel);
  origin.updateMatrixWorld(true);
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const point = panel.getWorldPosition(new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
  const difference = point.clone().sub(eye);
  expect(difference.y).toBeCloseTo(-0.12);
  difference.y = 0;
  expect(difference.length()).toBeCloseTo(1.8);
  expect(difference.normalize().dot(forward)).toBeCloseTo(1);
  expect(panel.rotation.x).toBe(0);
  expect(panel.rotation.z).toBe(0);
});
