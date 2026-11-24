import { expect, it } from "vitest";
import * as THREE from "three";
import { dragHud, faceHud, placeHudInFront } from "./hudPlacement";

it('keeps an off-centre grip on the ray while the panel and tracked head move; release does not turn it again',()=>{
  const panel=new THREE.Group(),eye=new THREE.Vector3(.18,1.65,-.1),grip=new THREE.Vector3(-.79,.215,.012);
  const hit=new THREE.Vector3(-.8,1.68,-1.8);
  for(const dx of [0,.25,.65,.92,.66,.31]){
    hit.x=dx-.8;eye.x=.18+dx*.4;dragHud(panel,hit,grip,eye,true);
    expect(panel.localToWorld(grip.clone()).distanceTo(hit)).toBeLessThan(1e-8);
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(panel.quaternion);
    expect(normal.dot(eye.clone().sub(panel.position).setY(0).normalize())).toBeCloseTo(1,12);
  }
  hit.x=4;dragHud(panel,hit,grip,eye,true);const bounded=panel.quaternion.clone();
  expect(panel.position.x).toBe(1.8);faceHud(panel,eye);expect(panel.quaternion.toArray()).toEqual(bounded.toArray());
  hit.x=0;dragHud(panel,hit,grip,eye,false);expect(panel.quaternion.toArray()).toEqual(bounded.toArray());
  expect(panel.localToWorld(grip.clone()).distanceTo(hit)).toBeLessThan(1e-8);
});

it('keeps the recalled HUD readable relative to the floor at the stellar equator and antipode',()=>{
  const origin=new THREE.Group(),camera=new THREE.PerspectiveCamera(),panel=new THREE.Group();origin.add(camera,panel);
  camera.position.set(.17,1.65,-.11);camera.rotation.set(.35,.2,0,'YXZ');
  for(const tilt of [Math.PI/2,Math.PI]){origin.rotation.x=tilt;origin.position.set(0,-12,0);origin.updateMatrixWorld(true);
    placeHudInFront(camera,origin,panel);const difference=panel.position.clone().sub(camera.position);
    expect(difference.y).toBeCloseTo(-.12);expect(difference.setY(0).length()).toBeCloseTo(1.8);
    expect(difference.normalize().dot(new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).setY(0).normalize())).toBeCloseTo(1);
  }
});

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
