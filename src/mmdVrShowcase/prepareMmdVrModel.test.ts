import { describe, expect, it } from "vitest";
import * as THREE from "three";
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
});
