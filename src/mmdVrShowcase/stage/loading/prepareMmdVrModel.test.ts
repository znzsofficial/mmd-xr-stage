import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMmdMaterialRenderOrderMeshes } from "@yohawing/three-mmd-loader";
import { modelDrawRange } from "../../mmdRuntime/modelDrawRange";
import { prepareMmdVrModel } from "./prepareMmdVrModel";

describe("prepareMmdVrModel", () => {
  it("disables model culling without changing material face settings", () => {
    const root = new THREE.Group();
    const front = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const back = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [front, back]);
    root.add(mesh);

    prepareMmdVrModel(root);

    expect(root.frustumCulled).toBe(false);
    expect(mesh.frustumCulled).toBe(false);
    expect(front.side).toBe(THREE.FrontSide);
    expect(back.side).toBe(THREE.BackSide);
  });

  it("adds the stage's SDEF depth material without taking over loader draw ranges", () => {
    const geometry = new THREE.BoxGeometry();
    geometry.clearGroups();
    geometry.addGroup(0, 6, 0);
    geometry.addGroup(6, 30, 1);
    geometry.setAttribute("matricesSdefEnabled", new THREE.Float32BufferAttribute(geometry.attributes.position.count, 1));
    geometry.morphAttributes.position = [geometry.attributes.position.clone()];
    const source = new THREE.SkinnedMesh(geometry, [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    source.bind(new THREE.Skeleton([]));
    const proxies = createMmdMaterialRenderOrderMeshes({mesh: source, materials: []});
    const draw = proxies.find(p => p.userData.mmdMaterialRenderProxy.materialIndex === 1)!;
    const pick = draw.raycast, shadow = draw.onBeforeShadow;
    geometry.setDrawRange(0, 0); // the logical source does not draw
    expect(draw.geometry).toBe(geometry);
    expect(draw.customDepthMaterial).toBeUndefined();

    prepareMmdVrModel(new THREE.Group().add(source, ...proxies));

    expect(draw.geometry).toBe(geometry);
    expect(draw.raycast).toBe(pick);
    expect(draw.onBeforeShadow).toBe(shadow);
    expect(modelDrawRange(draw)).toEqual({start: 6, count: 30});
    expect(geometry.drawRange).toEqual({start: 0, count: 0});
    expect(draw.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(draw.customDepthMaterial?.customProgramCacheKey()).toContain("stage-rig-space");
  });
});
