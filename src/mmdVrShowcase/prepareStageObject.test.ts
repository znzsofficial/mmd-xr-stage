import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { prepareStageObject } from "./prepareStageObject";

describe("stage object bounds", () => {
  it("culls ordinary scenery but leaves skinned and morph bounds conservative", () => {
    const root = new THREE.Group();
    const staticMesh = new THREE.Mesh(new THREE.BoxGeometry());
    const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry());
    const morph = new THREE.Mesh(new THREE.BoxGeometry());
    morph.morphTargetInfluences = [0];
    root.add(staticMesh, skin, morph);
    prepareStageObject(root);
    expect(staticMesh.frustumCulled).toBe(true);
    expect(staticMesh.geometry.boundingSphere).not.toBeNull();
    expect(skin.frustumCulled).toBe(false);
    expect(morph.frustumCulled).toBe(false);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    root.position.set(0, 0, -5); root.updateMatrixWorld(true);
    expect(frustum.intersectsObject(staticMesh)).toBe(true);
    root.position.x = 50; root.scale.setScalar(2); root.updateMatrixWorld(true);
    expect(frustum.intersectsObject(staticMesh)).toBe(false);
  });
});
